// Vercel cron function - sends reminder emails for due cards
// Schedule: every 15 minutes via vercel.json crons config
// Requires env vars: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Allow GET (cron) and POST (manual trigger)
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }
  if (!resendKey) {
    return res.status(200).json({ skipped: true, reason: "no_resend_key" });
  }

  try {
    // Find cards with reminders due in the next 16 minutes (cron fires every 15 min)
    // plus any missed in the last 15 minutes (catch-up window)
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 16 * 60 * 1000).toISOString();

    // Fetch due cards with reminder_time in window, not yet notified, not done
    const cardsRes = await fetch(
      `${supabaseUrl}/rest/v1/unified_cards?select=id,title,details,topic,type,status,reminder_time,reminder_notified_at,pair_id&reminder_time=gte.${windowStart}&reminder_time=lte.${windowEnd}&reminder_notified_at=is.null&status=neq.done&status=neq.paid&deleted_at=is.null`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!cardsRes.ok) {
      const err = await cardsRes.text();
      return res.status(500).json({ error: "Supabase query failed", detail: err });
    }

    const cards = await cardsRes.json();
    if (!cards.length) return res.status(200).json({ sent: 0, message: "No reminders due" });

    // Get unique pair_ids to look up parent emails
    const pairIds = [...new Set(cards.map((c) => c.pair_id).filter(Boolean))];

    // Fetch profiles for those pairs
    const profilesRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id,display_name,pair_id&pair_id=in.(${pairIds.join(",")})`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const profiles = profilesRes.ok ? await profilesRes.json() : [];

    // Get auth emails for those user IDs
    const userIds = profiles.map((p) => p.id);
    const emailMap = {}; // userId -> email

    if (userIds.length) {
      const usersRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?per_page=50`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      if (usersRes.ok) {
        const { users = [] } = await usersRes.json();
        users.forEach((u) => { if (u.email) emailMap[u.id] = u.email; });
      }
    }

    // Build pair -> recipients map
    const pairRecipients = {};
    profiles.forEach((p) => {
      if (!pairRecipients[p.pair_id]) pairRecipients[p.pair_id] = [];
      const email = emailMap[p.id];
      if (email) pairRecipients[p.pair_id].push({ email, name: p.display_name || "Parent" });
    });

    let sent = 0;
    const notifiedIds = [];

    for (const card of cards) {
      const recipients = pairRecipients[card.pair_id] || [];
      if (!recipients.length) continue;

      const topic = card.topic || "General";
      const dueText = card.reminder_time
        ? new Date(card.reminder_time).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" })
        : "";

      const html = `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="background: #65d6c6; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <span style="font-size: 18px; font-weight: 900; color: white;">D</span>
          </div>
          <p style="font-size: 12px; color: #78747e; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">${topic}</p>
          <h1 style="font-size: 20px; font-weight: 800; margin: 0 0 8px;">${card.title}</h1>
          ${card.details ? `<p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${card.details}</p>` : ""}
          ${dueText ? `<p style="font-size: 13px; color: #78747e; margin: 0 0 24px;">Reminder: ${dueText}</p>` : ""}
          <a href="https://do-do.vercel.app" style="display: inline-block; background: #65d6c6; color: white; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 999px; text-decoration: none;">Open Do-Do</a>
        </div>
      `;

      for (const recipient of recipients) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Do-Do <reminders@do-do.app>",
            to: [recipient.email],
            subject: `Reminder: ${card.title}`,
            html,
          }),
        });
        if (emailRes.ok) sent++;
      }

      notifiedIds.push(card.id);
    }

    // Mark cards as notified
    if (notifiedIds.length) {
      await fetch(
        `${supabaseUrl}/rest/v1/unified_cards?id=in.(${notifiedIds.join(",")})`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ reminder_notified_at: now.toISOString() }),
        }
      );
    }

    return res.status(200).json({ sent, cards: notifiedIds.length });
  } catch (err) {
    console.error("remind error:", err);
    return res.status(500).json({ error: err.message });
  }
}
