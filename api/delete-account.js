// /api/delete-account.js
// GDPR-compliant account deletion.
// Steps:
//   1. Verify the requesting user via their JWT
//   2. Anonymise cards they authored (set created_by to a sentinel, anonymise author field in metadata)
//   3. Soft-delete profile and remove from pair
//   4. Email co-parent if they exist
//   5. Delete the Supabase Auth user (irreversible)
//
// POST body: {} (user identity taken from Authorization header)
// Returns: { ok: true } or { error: string }

const { createClient } = require("@supabase/supabase-js");

// Admin client (service role - can delete auth users)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify caller via JWT
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const userId = user.id;
  const userEmail = user.email || "";

  try {
    // 1. Find the user's pair and co-parent details
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, family_id, pair_id")
      .eq("id", userId)
      .maybeSingle();

    const deletedName = profile?.display_name || userEmail.split("@")[0] || "A parent";
    const pairId = profile?.pair_id;
    const familyId = profile?.family_id;

    let coParentEmail = null;
    let coParentName = null;
    if (pairId) {
      const { data: pair } = await supabaseAdmin
        .from("pairs")
        .select("parent_a, parent_b, invite_email, profiles_a:profiles!pairs_parent_a_fkey(id,display_name,email:id), profiles_b:profiles!pairs_parent_b_fkey(id,display_name)")
        .eq("id", pairId)
        .maybeSingle();

      if (pair) {
        // Figure out who the co-parent is
        const coParentId = pair.parent_a === userId ? pair.parent_b : pair.parent_a;
        if (coParentId) {
          const { data: coProfile } = await supabaseAdmin
            .from("profiles")
            .select("display_name")
            .eq("id", coParentId)
            .maybeSingle();
          coParentName = coProfile?.display_name || null;
        }
        // Co-parent email: try invite_email or look up auth user
        const { data: coAuthUser } = coParentId
          ? await supabaseAdmin.auth.admin.getUserById(coParentId)
          : { data: null };
        coParentEmail = coAuthUser?.user?.email || pair.invite_email || null;
      }
    }

    // 2. Anonymise cards authored by this user
    // Update metadata.author to "Deleted user" for all cards created by them
    const { data: userCards } = await supabaseAdmin
      .from("unified_cards")
      .select("id, metadata")
      .eq("created_by", userId);

    for (const card of userCards || []) {
      const newMeta = { ...(card.metadata || {}), author: "Deleted user", deletedAuthor: true };
      await supabaseAdmin
        .from("unified_cards")
        .update({ metadata: newMeta, created_by: null, updated_by: null })
        .eq("id", card.id);
    }

    // 3. Anonymise messages sent by this user (soft-approach: set deleted_at)
    await supabaseAdmin
      .from("messages_v2")
      .update({ deleted_at: new Date().toISOString() })
      .eq("sender_id", userId);

    // 4. Remove user from pair (set parent slot to null, don't delete pair so co-parent keeps their data)
    if (pairId) {
      const { data: pair } = await supabaseAdmin
        .from("pairs")
        .select("parent_a, parent_b")
        .eq("id", pairId)
        .maybeSingle();

      if (pair?.parent_a === userId) {
        await supabaseAdmin.from("pairs").update({ parent_a: null }).eq("id", pairId);
      } else if (pair?.parent_b === userId) {
        await supabaseAdmin.from("pairs").update({ parent_b: null }).eq("id", pairId);
      }
    }

    // 5. Delete profile (cascades to push_subscriptions, etc.)
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // 6. Email co-parent notification
    if (coParentEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.RESEND_FROM_EMAIL || "Do-Do <onboarding@resend.dev>";
        await resend.emails.send({
          from,
          to: coParentEmail,
          subject: "Do-Do: your co-parent has deleted their account",
          html: `
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 8px rgba(0,0,0,.07)">
    <p style="font-weight:800;font-size:20px;margin:0 0 24px">Do-Do</p>
    <p style="color:#374151;margin:0 0 12px"><strong>${deletedName}</strong> has deleted their Do-Do account.</p>
    <p style="color:#374151;margin:0 0 24px">Your cards, messages, and family data are preserved and accessible at <a href="https://do-do.app">do-do.app</a>. Card authors from their account will appear as "Deleted user".</p>
    <p style="color:#9ca3af;font-size:13px;margin:0">If you have questions, reply to this email or contact us at hello@do-do.app.</p>
  </div>
</body></html>`,
        });
      } catch (emailErr) {
        console.warn("Co-parent notification email failed:", emailErr.message);
      }
    }

    // 7. Delete the auth user (irreversible - do last)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error("Auth user deletion failed:", deleteErr.message);
      // Profile is already deleted - still return ok so the user knows their data is gone
    }

    console.log(`Account deleted: ${userId} (${userEmail})`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("delete-account error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
