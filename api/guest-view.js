// /api/guest-view.js
// SEG-13: Read-only guest preview for the second parent - no account required.
// GET ?token=<invite_token>
// Returns a sanitized snapshot: inviter name, children names, recent cards
// (limited fields only - no bodies, no messages, no receipts, no IDs).
//
// SEG-11.3: Also handles mediator stats page
// GET ?type=mediator&code=<code>
//
// KID ACCESS (PIN-protected read + card creation)
// POST { type: "kid-auth", token, pin }           -> verify PIN, return session JWT
// GET  ?type=kid&token=xxx&session=yyy            -> return kid dashboard data
// POST { type: "kid-card", token, session, ... }  -> create a card on parent board

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Kid session helpers ──────────────────────────────────────────────────────

function kidSessionSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-dev-secret";
}

function signKidSession(kidToken) {
  const payload = Buffer.from(JSON.stringify({
    k: kidToken,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", kidSessionSecret()).update(payload).digest("base64url");
  return payload + "." + sig;
}

function verifyKidSession(session) {
  if (!session || typeof session !== "string") return null;
  const dot = session.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = session.slice(0, dot);
  const sig = session.slice(dot + 1);
  const expected = crypto.createHmac("sha256", kidSessionSecret()).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.k || !data.exp || Date.now() > data.exp) return null;
    return data.k;
  } catch {
    return null;
  }
}

// ─── Kid PIN auth ─────────────────────────────────────────────────────────────

async function handleKidAuth(req, res) {
  const { token, pin } = req.body || {};
  if (!token || !pin || !/^\d{4}$/.test(String(pin))) {
    return res.status(400).json({ error: "invalid_request" });
  }

  const { data: child } = await supabaseAdmin
    .from("children")
    .select("id, name, kid_pin_hash, kid_pin_salt, kid_pin_attempts, kid_pin_locked_until")
    .eq("kid_token", token)
    .maybeSingle();

  if (!child || !child.kid_pin_hash) return res.status(404).json({ error: "not_found" });

  if (child.kid_pin_locked_until && new Date(child.kid_pin_locked_until) > new Date()) {
    return res.status(429).json({ error: "locked", until: child.kid_pin_locked_until });
  }

  const hashAttempt = crypto.pbkdf2Sync(
    String(pin), child.kid_pin_salt, 100000, 32, "sha256"
  ).toString("hex");

  if (hashAttempt !== child.kid_pin_hash) {
    const attempts = (child.kid_pin_attempts || 0) + 1;
    const update = attempts >= 5
      ? { kid_pin_attempts: attempts, kid_pin_locked_until: new Date(Date.now() + 10 * 60 * 1000).toISOString() }
      : { kid_pin_attempts: attempts };
    await supabaseAdmin.from("children").update(update).eq("id", child.id);
    return res.status(401).json({ error: "wrong_pin", attemptsLeft: Math.max(0, 5 - attempts) });
  }

  await supabaseAdmin.from("children")
    .update({ kid_pin_attempts: 0, kid_pin_locked_until: null })
    .eq("id", child.id);

  return res.status(200).json({ ok: true, session: signKidSession(token), childName: child.name });
}

// ─── Kid dashboard data ───────────────────────────────────────────────────────

async function handleKidData(req, res) {
  const token = (req.query.token || "").trim();
  const session = (req.query.session || req.headers["x-kid-session"] || "").trim();

  if (verifyKidSession(session) !== token) {
    return res.status(401).json({ error: "invalid_session" });
  }

  const { data: child } = await supabaseAdmin
    .from("children")
    .select("id, name, family_id, kid_note")
    .eq("kid_token", token)
    .maybeSingle();

  if (!child) return res.status(404).json({ error: "not_found" });

  const { data: pair } = await supabaseAdmin
    .from("pairs")
    .select("id, parent_a, parent_b, profiles!pairs_parent_a_fkey(display_name)")
    .eq("family_id", child.family_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pair) return res.status(404).json({ error: "no_pair" });

  const windowStart = new Date(Date.now() - 2 * 86400000).toISOString();
  const windowEnd   = new Date(Date.now() + 14 * 86400000).toISOString();

  const { data: datedCards } = await supabaseAdmin
    .from("unified_cards")
    .select("id, title, card_type, status, due_at, metadata")
    .eq("pair_id", pair.id)
    .eq("child_label", child.name)
    .is("deleted_at", null)
    .gte("due_at", windowStart)
    .lte("due_at", windowEnd)
    .order("due_at", { ascending: true })
    .limit(40);

  const { data: undatedCards } = await supabaseAdmin
    .from("unified_cards")
    .select("id, title, card_type, status, due_at, metadata")
    .eq("pair_id", pair.id)
    .eq("child_label", child.name)
    .is("deleted_at", null)
    .is("due_at", null)
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .limit(10);

  let coparentName = null;
  if (pair.parent_b) {
    const { data: coProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", pair.parent_b)
      .maybeSingle();
    coparentName = coProfile?.display_name || null;
  }

  const allCards = [...(datedCards || []), ...(undatedCards || [])].map((c) => ({
    id: c.id,
    title: c.title || "",
    type: c.card_type || "task",
    status: c.status || "todo",
    dueAt: c.due_at || null,
    createdByKid: !!(c.metadata?.created_by_kid),
  }));

  return res.status(200).json({
    childName: child.name,
    parentAName: pair.profiles?.display_name || null,
    parentBName: coparentName,
    note: child.kid_note || null,
    cards: allCards,
  });
}

// ─── Kid card creation ────────────────────────────────────────────────────────

async function handleKidCard(req, res) {
  const { token, session, title, due, details } = req.body || {};

  if (verifyKidSession(session) !== token) {
    return res.status(401).json({ error: "invalid_session" });
  }

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "title_required" });
  }

  const { data: child } = await supabaseAdmin
    .from("children")
    .select("id, name, family_id")
    .eq("kid_token", token)
    .maybeSingle();

  if (!child) return res.status(404).json({ error: "not_found" });

  const { data: pair } = await supabaseAdmin
    .from("pairs")
    .select("id, parent_a")
    .eq("family_id", child.family_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pair) return res.status(404).json({ error: "no_pair" });

  const cleanTitle   = title.trim().slice(0, 200);
  const cleanDetails = (details || "").trim().slice(0, 1000) || null;
  const cleanDue     = due && /^\d{4}-\d{2}-\d{2}/.test(String(due))
    ? new Date(due).toISOString()
    : null;

  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("unified_cards")
    .insert({
      id: crypto.randomUUID(),
      pair_id: pair.id,
      created_by: pair.parent_a,
      updated_by: pair.parent_a,
      title: cleanTitle,
      body: cleanDetails,
      topic: "school",
      card_type: "task",
      status: "todo",
      assigned_to: "both",
      child_label: child.name,
      due_at: cleanDue,
      edit_history: [{ ts: now, by: "kid:" + child.name, action: "create" }],
      metadata: {
        created_by_kid: true,
        kid_name: child.name,
        comments: [],
        acknowledged: false,
        createdAt: Date.now(),
      },
    });

  if (error) {
    console.error("kid-card insert error:", error.message);
    return res.status(500).json({ error: "server_error" });
  }

  return res.status(201).json({ ok: true });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // ─── POST: kid routes only ────────────────────────────────────────────────
  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    if (body.type === "kid-auth") return handleKidAuth({ ...req, body }, res);
    if (body.type === "kid-card") return handleKidCard({ ...req, body }, res);
    return res.status(400).json({ error: "unknown_type" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ─── GET: kid dashboard data ──────────────────────────────────────────────
  if (req.query.type === "kid") return handleKidData(req, res);

  // ─── SEG-11.3: Mediator stats (no auth) ──────────────────────────────────
  if (req.query.type === "mediator") {
    const code = (req.query.code || "").trim();
    if (!code || code.length < 6 || !/^[A-Za-z0-9_-]+$/.test(code)) {
      return res.status(404).json({ error: "invalid_code" });
    }
    try {
      const { data: pairs } = await supabaseAdmin
        .from("pairs")
        .select("id, created_at, parent_a, parent_b")
        .eq("mediator_code", code);

      const referred = (pairs || []).length;
      if (referred === 0) {
        return res.status(200).json({ referred: 0, bothActive: 0, avgDays: 0, code });
      }

      const pairIds = pairs.map((p) => p.id);
      const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();

      const { data: recentCards } = await supabaseAdmin
        .from("unified_cards")
        .select("pair_id, created_by")
        .in("pair_id", pairIds)
        .gte("created_at", cutoff)
        .is("deleted_at", null);

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

  // ─── Original invite token guest preview ──────────────────────────────────
  const token = (req.query.token || "").trim();
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

    let children = [];
    if (pair.family_id) {
      const { data: kids } = await supabaseAdmin
        .from("children")
        .select("name")
        .eq("family_id", pair.family_id)
        .order("created_at", { ascending: true });
      children = (kids || []).map((c) => c.name).filter(Boolean);
    }

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
