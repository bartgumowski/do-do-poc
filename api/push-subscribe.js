// Vercel serverless function - saves/removes web push subscriptions
// Also handles action=notify-partner (send push to co-parent, no new function needed)
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

  // ── action=notify-partner: send immediate push to co-parent ──────────────────
  // Body: { action: "notify-partner", title, body, url }
  if (req.method === "POST" && req.body?.action === "notify-partner") {
    const { title, body: msgBody, url } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });

    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || "mailto:hello@do-do.app";

    // Find co-parent's user ID (same pair, different user)
    const myProfileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=pair_id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const [myProfile] = myProfileRes.ok ? await myProfileRes.json() : [];
    if (!myProfile?.pair_id) return res.status(200).json({ sent: 0, reason: "not in a pair" });

    const partnerRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?pair_id=eq.${myProfile.pair_id}&id=neq.${user.id}&select=id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const partners = partnerRes.ok ? await partnerRes.json() : [];
    if (!partners.length) return res.status(200).json({ sent: 0, reason: "no co-parent yet" });
    const partnerId = partners[0].id;

    if (!vapidPublic || !vapidPrivate) return res.status(200).json({ sent: 0, reason: "VAPID not configured" });

    // Get co-parent's push subscriptions
    const subsRes = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${partnerId}&select=endpoint,p256dh,auth`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const subs = subsRes.ok ? await subsRes.json() : [];
    if (!subs.length) return res.status(200).json({ sent: 0, reason: "co-parent has no push subscriptions" });

    let webpush;
    try {
      webpush = (await import("web-push")).default;
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    } catch {
      return res.status(503).json({ error: "web-push unavailable" });
    }

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body: msgBody || "", tag: "schedule-change", data: { url: url || "/#calendar" } })
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await fetch(
            `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
            { method: "DELETE", headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
          );
        }
      }
    }
    return res.status(200).json({ sent });
  }

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
