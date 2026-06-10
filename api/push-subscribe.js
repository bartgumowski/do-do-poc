// Vercel serverless function - saves/removes web push subscriptions
// Called from app.js after user grants notification permission
// Auth (SEG-14): Authorization: Bearer <supabase_jwt> required.
// user_id is derived from the verified token, never from the body.
// Env vars needed: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const { requireUser } = require("./_auth");

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).end();
  }

  const user = await requireUser(req, res);
  if (!user) return;

  // DELETE - unsubscribe (scoped to the caller's own subscriptions)
  if (req.method === "DELETE") {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "endpoint required" });
    await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&user_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "DELETE",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }
    );
    return res.status(200).json({ ok: true });
  }

  const { endpoint, p256dh, auth } = req.body || {};
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "endpoint, p256dh, auth required" });
  }

  // Upsert subscription (conflict on endpoint)
  const r = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: user.id, endpoint, p256dh, auth }),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error("push-subscribe upsert failed:", err);
    return res.status(500).json({ error: "Could not save subscription" });
  }
  return res.status(200).json({ ok: true });
};
