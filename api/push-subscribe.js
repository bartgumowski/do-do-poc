// Vercel serverless function - saves/removes web push subscriptions
// Called from app.js after user grants notification permission
// Env vars needed: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  // DELETE - unsubscribe
  if (req.method === "DELETE") {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "endpoint required" });
    await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: "DELETE",
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") return res.status(405).end();

  const { user_id, endpoint, p256dh, auth } = req.body || {};
  if (!user_id || !endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "user_id, endpoint, p256dh, auth required" });
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
    body: JSON.stringify({ user_id, endpoint, p256dh, auth }),
  });

  if (!r.ok) {
    const err = await r.text();
    return res.status(500).json({ error: err });
  }
  return res.status(200).json({ ok: true });
}
