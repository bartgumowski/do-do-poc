// /api/export-data.js
// GDPR data portability: exports all personal data for the requesting user as JSON.
// GET with Authorization: Bearer <jwt>
// Returns: JSON file download containing profile, cards, messages, shopping, expenses

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const userId = user.id;

  try {
    // Profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, first_name, role, family_id, pair_id, notification_prefs, timezone, created_at")
      .eq("id", userId)
      .maybeSingle();

    const familyId = profile?.family_id;
    const pairId = profile?.pair_id;

    // Cards (all family cards where user is created_by, or whole family set for transparency)
    const { data: cards } = await supabaseAdmin
      .from("unified_cards")
      .select("id, title, body, topic, card_type, status, assigned_to, child_label, due_at, amount, payment_status, payment_amount, receipt_url, metadata, created_at, updated_at")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    // Messages sent by user
    const { data: messages } = pairId ? await supabaseAdmin
      .from("messages_v2")
      .select("id, topic, body, card_id, created_at")
      .eq("sender_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      : { data: [] };

    // Shopping items added by user
    const { data: shopping } = familyId ? await supabaseAdmin
      .from("shopping_items")
      .select("id, list, name, checked, checked_at, created_at")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      : { data: [] };

    // Children
    const { data: children } = familyId ? await supabaseAdmin
      .from("children")
      .select("id, name, created_at")
      .eq("family_id", familyId)
      : { data: [] };

    // Build export object
    const exportData = {
      export_generated_at: new Date().toISOString(),
      export_format_version: "1.0",
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        profile: profile || null,
      },
      family: {
        family_id: familyId || null,
        pair_id: pairId || null,
        children: children || [],
      },
      cards: (cards || []).map((c) => ({
        id: c.id,
        title: c.title,
        details: c.body,
        topic: c.topic,
        type: c.card_type,
        status: c.status,
        assigned_to: c.assigned_to,
        child: c.child_label,
        due: c.due_at,
        amount: c.amount,
        payment_status: c.payment_status,
        payment_amount: c.payment_amount,
        comments: c.metadata?.comments || [],
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
      messages: (messages || []).map((m) => ({
        id: m.id,
        topic: m.topic,
        body: m.body,
        card_id: m.card_id,
        sent_at: m.created_at,
      })),
      shopping_items: (shopping || []).map((s) => ({
        id: s.id,
        list: s.list,
        name: s.name,
        checked: s.checked,
        checked_at: s.checked_at,
        added_at: s.created_at,
      })),
    };

    const filename = `do-do-export-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    console.error("export-data error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
