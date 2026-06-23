// /api/guest-view.js
// SEG-13: Read-only guest preview for the second parent - no account required.
// GET ?token=<invite_token>
// Returns a sanitized snapshot: inviter name, children names, recent cards
// (limited fields only - no bodies, no messages, no receipts, no IDs).
//
// SEG-11.3: Also handles mediator stats page
// GET ?type=mediator&code=<code>

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

  // ─── SEG-11.3: Mediator stats (no auth) ──────────────────────────────────────
  if (req.query.type === "mediator") {
    const code = (req.query.code || "").trim();
    if (!code || code.length < 6 || !/^[A-Za-z0-9_-]+$/.test(code)) {
      return res.status(404).json({ error: "invalid_code" });
    }
    try {
      // Find all pairs referred by this mediator code
      const { data: pairs } = await supabaseAdmin
        .from("pairs")
        .select("id, created_at, parent_a, parent_b")
        .eq("mediator_code", code);

      const referred = (pairs || []).length;
      if (referred === 0) {
        return res.status(200).json({ referred: 0, bothActive: 0, avgDays: 0, code });
      }

      // For each pair, check if both parents have activity (cards created) in last 14 days
      const pairIds = pairs.map((p) => p.id);
      const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();

      const { data: recentCards } = await supabaseAdmin
        .from("unified_cards")
        .select("pair_id, created_by")
        .in("pair_id", pairIds)
        .gte("created_at", cutoff)
        .is("deleted_at", null);

      // Group active users per pair
      const activePairUsers = {};
      (recentCards || []).forEach((c) => {
        if (!activePairUsers[c.pair_id]) activePairUsers[c.pair_id] = new Set();
        activePairUsers[c.pair_id].add(c.created_by);
      });

      let bothActive = 0;
      let totalDays = 0;
      pairs.forEach((p) => {
        const activeUsers = activePairUsers[p.id]?.size || 0;
        if (activeUsers >= 2) bothActive++;
        totalDays += Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
      });

      const avgDays = Math.round(totalDays / referred);

      return res.status(200).json({ referred, bothActive, avgDays, code });
    } catch (err) {
      console.error("mediator-stats error:", err.message);
      return res.status(500).json({ error: "server_error" });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

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
