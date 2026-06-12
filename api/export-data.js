// /api/export-data.js
// GDPR data portability: exports all personal data for the requesting user as JSON.
// GET with Authorization: Bearer <jwt>
// Returns: JSON file download containing profile, cards, messages, shopping, expenses

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // SEG-16: action=expenses returns expense+ledger JSON; action=expenses-csv returns CSV
  const action = req.query.action || "gdpr";

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const userId = user.id;

  // ─── SEG-16: Expense export routes ───────────────────────────────────────────
  if (action === "expenses" || action === "expenses-csv") {
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("display_name, first_name, pair_id, family_id")
        .eq("id", userId)
        .maybeSingle();

      const pairId = profile?.pair_id;
      if (!pairId) return res.status(400).json({ error: "No pair found" });

      // Date range filter from query params
      const from = req.query.from || null;
      const to   = req.query.to   || null;

      // Fetch all expense cards for this pair
      let cardQuery = supabaseAdmin
        .from("unified_cards")
        .select("id, title, body, amount, payment_status, payment_amount, payment_paid_at, receipt_url, created_at, updated_at")
        .eq("pair_id", pairId)
        .eq("card_type", "Expense")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (from) cardQuery = cardQuery.gte("created_at", from);
      if (to)   cardQuery = cardQuery.lte("created_at", to);

      const { data: expenseCards } = await cardQuery;

      // Fetch ledger events for each card
      const cardIds = (expenseCards || []).map((c) => c.id);
      let ledgerRows = [];
      if (cardIds.length) {
        const { data: ledger } = await supabaseAdmin
          .from("expense_ledger")
          .select("*")
          .in("card_id", cardIds)
          .order("created_at", { ascending: true });
        ledgerRows = ledger || [];
      }

      // Build per-card ledger map
      const ledgerByCard = {};
      ledgerRows.forEach((ev) => {
        if (!ledgerByCard[ev.card_id]) ledgerByCard[ev.card_id] = [];
        ledgerByCard[ev.card_id].push(ev);
      });

      const cards = (expenseCards || []).map((c) => ({
        ...c,
        ledger: ledgerByCard[c.id] || [],
      }));

      if (action === "expenses-csv") {
        // Flat CSV of all ledger events
        const headers = ["date", "expense_title", "event_type", "actor_name", "amount", "currency", "stripe_intent_id", "note"];
        const rows = [];
        cards.forEach((card) => {
          if (!card.ledger.length) {
            // Card with no ledger events - still include a row
            rows.push([card.created_at, card.title, "no_ledger", "", card.amount || "", "", "", ""]);
          } else {
            card.ledger.forEach((ev) => {
              rows.push([
                ev.created_at,
                card.title,
                ev.event_type,
                ev.actor_name || "",
                ev.amount != null ? ev.amount : "",
                ev.currency || "",
                ev.stripe_intent_id || "",
                ev.note || "",
              ]);
            });
          }
        });

        const csv = [headers, ...rows]
          .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
          .join("\n");

        const filename = `do-do-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
      }

      // action === "expenses" - return JSON for client-side PDF generation
      // Compute summary totals
      const parseAmt = (v) => Number(String(v || "").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
      const totalAmount = cards.reduce((s, c) => s + parseAmt(c.amount), 0);
      const paidCards = cards.filter((c) => c.payment_status === "paid");
      const paidTotal = paidCards.reduce((s, c) => s + parseAmt(c.amount), 0);
      const openTotal = totalAmount - paidTotal;

      const exportPayload = {
        generated_at: new Date().toISOString(),
        user_name: profile?.display_name || profile?.first_name || "Parent",
        pair_id: pairId,
        date_range: { from: from || null, to: to || null },
        summary: {
          total_expenses: cards.length,
          total_amount: totalAmount,
          paid_total: paidTotal,
          open_total: openTotal,
        },
        expenses: cards,
      };

      const filename = `do-do-expenses-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json(exportPayload);
    } catch (err) {
      console.error("expense export error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

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
