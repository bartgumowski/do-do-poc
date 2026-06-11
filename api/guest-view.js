// /api/guest-view.js
// SEG-13: Read-only guest preview for the second parent - no account required.
// GET ?token=<invite_token>
// Returns a sanitized snapshot: inviter name, children names, recent cards
// (limited fields only - no bodies, no messages, no receipts, no IDs).

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const token = (req.query.token || "").trim();
  // Tokens are UUIDs / long random strings - reject anything short or odd early
  if (!token || token.length < 16 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return res.status(404).json({ error: "invalid_token" });
  }

  try {
    const { data: pair, error: pairErr } = await supabaseAdmin
      .from("pairs")
      .select("id, family_id, accepted_at, parent_a, profiles!pairs_parent_a_fkey(display_name)")
      .eq("invite_token", token)
      .maybeSingle();

    if (pairErr || !pair) return res.status(404).json({ error: "invalid_token" });
    if (pair.accepted_at) return res.status(410).json({ error: "already_accepted" });

    // Children names (first names only)
    let children = [];
    if (pair.family_id) {
      const { data: kids } = await supabaseAdmin
        .from("children")
        .select("name")
        .eq("family_id", pair.family_id)
        .order("created_at", { ascending: true });
      children = (kids || []).map((c) => c.name).filter(Boolean);
    }

    // Recent cards - LIMITED FIELDS ONLY. Never expose body, metadata,
    // receipt_url, messages, or row IDs to an unauthenticated caller.
    const { data: cards } = await supabaseAdmin
      .from("unified_cards")
      .select("title, card_type, status, child_label, due_at, amount, created_at")
      .eq("pair_id", pair.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    return res.status(200).json({
      inviterName: pair.profiles?.display_name || null,
      children,
      cards: (cards || []).map((c) => ({
        title: c.title || "",
        type: c.card_type || "task",
        status: c.status || "todo",
        child: c.child_label || null,
        dueAt: c.due_at || null,
        amount: c.amount ?? null,
        createdAt: c.created_at,
      })),
    });
  } catch (err) {
    console.error("guest-view error:", err);
    return res.status(500).json({ error: "server_error" });
  }
};
