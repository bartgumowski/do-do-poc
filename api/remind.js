// Vercel cron function - sends reminder emails + web push for due cards
// Schedule: every 15 minutes via vercel.json crons config
// Requires env vars: RESEND_API_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// Uses existing: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

// Inline VAPID / web-push implementation to avoid npm dependency
// Uses the Web Crypto API available in Node 18+ (Vercel default runtime)

async function encryptWebPush(subscription, payload) {
  // Dynamically import web-push if available, otherwise skip push silently
  try {
    const webpush = await import("web-push");
    return webpush;
  } catch {
    return null;
  }
}

function isInQuietHours(quietFrom, quietTo, userTimezone, quietEnabled) {
  // If quiet_enabled is explicitly false, never suppress
  if (quietEnabled === false) return false;
  if (!quietFrom || !quietTo) return false;
  try {
    const tz = userTimezone || "UTC";
    const now = new Date();
    const localStr = now.toLocaleString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
    const [h, m] = localStr.split(":").map(Number);
    const nowMins = h * 60 + m;
    const [fh, fm] = quietFrom.split(":").map(Number);
    const [th, tm] = quietTo.split(":").map(Number);
    const fromMins = fh * 60 + fm;
    const toMins = th * 60 + tm;
    if (fromMins <= toMins) {
      return nowMins >= fromMins && nowMins < toMins;
    } else {
      // Crosses midnight
      return nowMins >= fromMins || nowMins < toMins;
    }
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // SEG-14: no CORS - cron-invoked, same-origin only.
  // Allow GET (cron) and POST (manual trigger)
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:bart@do-do.app";

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  // Setup web-push if VAPID keys are available
  let webpush = null;
  if (vapidPublic && vapidPrivate) {
    try {
      webpush = (await import("web-push")).default;
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    } catch {
      // web-push not installed - push will be skipped
    }
  }

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 16 * 60 * 1000).toISOString();

    // Fetch due cards
    const cardsRes = await fetch(
      `${supabaseUrl}/rest/v1/unified_cards?select=id,title,details,topic,type,status,assignee,reminder_time,reminder_notified_at,pair_id&reminder_time=gte.${windowStart}&reminder_time=lte.${windowEnd}&reminder_notified_at=is.null&status=neq.done&status=neq.paid&deleted_at=is.null`,
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

    // ─── Daily maintenance (backup + deletion queue) - runs regardless of reminders ─
    try { await _runDailyBackup(supabaseUrl, supabaseKey); } catch (e) { console.error("Daily backup failed:", e.message); }
    try { await _processDeletionQueue(supabaseUrl, supabaseKey); } catch (e) { console.error("Deletion queue failed:", e.message); }

    const cards = await cardsRes.json();
    if (!cards.length) return res.status(200).json({ sent: 0, message: "No reminders due" });

    const pairIds = [...new Set(cards.map((c) => c.pair_id).filter(Boolean))];

    // Fetch profiles with notification prefs (include role for smart routing)
    const profilesRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id,display_name,pair_id,notification_prefs,timezone,role&pair_id=in.(${pairIds.join(",")})`,
      {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }
    );
    const profiles = profilesRes.ok ? await profilesRes.json() : [];
    const profileMap = {}; // userId -> profile
    profiles.forEach((p) => { profileMap[p.id] = p; });

    // Get auth emails
    const userIds = profiles.map((p) => p.id);
    const emailMap = {};
    if (userIds.length) {
      const usersRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?per_page=50`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (usersRes.ok) {
        const { users = [] } = await usersRes.json();
        users.forEach((u) => { if (u.email) emailMap[u.id] = u.email; });
      }
    }

    // Get push subscriptions for these users
    const pushSubMap = {}; // userId -> [subscription]
    if (userIds.length && webpush) {
      const pushRes = await fetch(
        `${supabaseUrl}/rest/v1/push_subscriptions?select=user_id,endpoint,p256dh,auth&user_id=in.(${userIds.join(",")})`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (pushRes.ok) {
        const subs = await pushRes.json();
        subs.forEach((s) => {
          if (!pushSubMap[s.user_id]) pushSubMap[s.user_id] = [];
          pushSubMap[s.user_id].push(s);
        });
      }
    }

    // Build pair -> recipients map
    const pairRecipients = {};
    profiles.forEach((p) => {
      if (!pairRecipients[p.pair_id]) pairRecipients[p.pair_id] = [];
      const email = emailMap[p.id];
      pairRecipients[p.pair_id].push({
        userId: p.id,
        email,
        name: p.display_name || "Parent",
        prefs: p.notification_prefs || { email: true, push: true },
        timezone: p.timezone || "UTC",
        pairRole: p.role || null, // "parent_a" | "parent_b"
      });
    });

    let sentEmail = 0;
    let sentPush = 0;
    const notifiedIds = [];

    for (const card of cards) {
      const allRecipients = pairRecipients[card.pair_id] || [];
      if (!allRecipients.length) continue;

      // Smart routing: only notify the assigned person unless "Both parents" or unassigned
      const recipients = (() => {
        if (!card.assignee || card.assignee === "Both parents") return allRecipients;
        if (card.assignee === "Parent A") return allRecipients.filter((r) => r.pairRole === "parent_a");
        if (card.assignee === "Parent B") return allRecipients.filter((r) => r.pairRole === "parent_b");
        return allRecipients;
      })();

      if (!recipients.length) continue;

      const topic = card.topic || "General";
      const dueText = card.reminder_time
        ? new Date(card.reminder_time).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" })
        : "";

      for (const recipient of recipients) {
        const prefs = recipient.prefs || { email: true, push: true };
        const inQuiet = isInQuietHours(prefs.quiet_from, prefs.quiet_to, recipient.timezone, prefs.quiet_enabled);

        // Email
        if (prefs.email !== false && recipient.email && !inQuiet && resendKey) {
          const html = `
            <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <div style="background: #65d6c6; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="font-size: 18px; font-weight: 900; color: white;">D</span>
              </div>
              <p style="font-size: 12px; color: #78747e; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">${topic}</p>
              <h1 style="font-size: 20px; font-weight: 800; margin: 0 0 8px;">${card.title}</h1>
              ${card.details ? `<p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${card.details}</p>` : ""}
              ${dueText ? `<p style="font-size: 13px; color: #78747e; margin: 0 0 24px;">Reminder: ${dueText}</p>` : ""}
              <a href="https://do-do.app/#board" style="display: inline-block; background: #65d6c6; color: white; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 999px; text-decoration: none;">Open Do-Do</a>
            </div>
          `;
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL || "Do-Do <reminders@resend.dev>",
              to: [recipient.email],
              subject: `Reminder: ${card.title}`,
              html,
            }),
          });
          if (emailRes.ok) sentEmail++;
        }

        // Web push
        if (prefs.push !== false && !inQuiet && webpush) {
          const subs = pushSubMap[recipient.userId] || [];
          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                JSON.stringify({
                  title: card.title,
                  body: dueText ? `Due: ${dueText}` : topic,
                  tag: `card-${card.id}`,
                  data: { cardId: card.id, url: "https://do-do.app/#board" },
                })
              );
              sentPush++;
            } catch (pushErr) {
              // Subscription expired - clean it up
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                await fetch(
                  `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
                  { method: "DELETE", headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
                );
              }
            }
          }
        }
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

    return res.status(200).json({ sentEmail, sentPush, cards: notifiedIds.length });
  } catch (err) {
    console.error("remind error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Daily backup helper ──────────────────────────────────────────────────────
// Exports all active pairs' cards, messages, and shopping items as JSON and
// uploads to Supabase Storage bucket "receipts" under daily-backups/.
// Retains the 7 most recent backups; older ones are deleted.

async function _runDailyBackup(supabaseUrl, supabaseKey) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `daily-backups/backup-${today}.json`;

  // Check if today's backup already exists (idempotent)
  const existsRes = await fetch(
    `${supabaseUrl}/storage/v1/object/info/receipts/${filename}`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  if (existsRes.ok) {
    console.log(`[backup] Today's backup already exists: ${filename}`);
    return;
  }

  // Fetch all non-deleted cards
  const cardsRes = await fetch(
    `${supabaseUrl}/rest/v1/unified_cards?select=id,pair_id,title,body,topic,card_type,status,assigned_to,child_label,due_at,amount,payment_status,created_at,updated_at,deleted_at&deleted_at=is.null&limit=10000`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const cards = cardsRes.ok ? await cardsRes.json() : [];

  // Fetch all non-deleted messages
  const msgsRes = await fetch(
    `${supabaseUrl}/rest/v1/messages_v2?select=id,pair_id,topic,body,sender_id,created_at&deleted_at=is.null&limit=10000`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const messages = msgsRes.ok ? await msgsRes.json() : [];

  // Fetch all shopping items
  const shopRes = await fetch(
    `${supabaseUrl}/rest/v1/shopping_items?select=id,family_id,list,name,checked,created_at&limit=10000`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const shopping = shopRes.ok ? await shopRes.json() : [];

  // Fetch all active pairs (metadata only - no PII)
  const pairsRes = await fetch(
    `${supabaseUrl}/rest/v1/pairs?select=id,created_at,subscription_status&limit=1000`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const pairs = pairsRes.ok ? await pairsRes.json() : [];

  const payload = JSON.stringify({
    backup_date: today,
    generated_at: new Date().toISOString(),
    format: "do-do-daily-backup-v1",
    counts: { pairs: pairs.length, cards: cards.length, messages: messages.length, shopping: shopping.length },
    pairs,
    cards,
    messages,
    shopping,
  });

  // Upload to Supabase Storage
  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/receipts/${filename}`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "x-upsert": "true",
      },
      body: payload,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Storage upload failed: ${errText}`);
  }

  console.log(`[backup] Backup stored: ${filename} (${(payload.length / 1024).toFixed(1)} KB)`);

  // Prune backups older than 7 days
  try {
    const listRes = await fetch(
      `${supabaseUrl}/storage/v1/object/list/receipts`,
      {
        method: "POST",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "daily-backups/", limit: 100 }),
      }
    );

    if (listRes.ok) {
      const files = await listRes.json();
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const toDelete = (files || [])
        .filter((f) => f.created_at < cutoff)
        .map((f) => `daily-backups/${f.name}`);

      if (toDelete.length) {
        await fetch(
          `${supabaseUrl}/storage/v1/object/receipts`,
          {
            method: "DELETE",
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prefixes: toDelete }),
          }
        );
        console.log(`[backup] Pruned ${toDelete.length} old backup(s)`);
      }
    }
  } catch (pruneErr) {
    // Prune failure is non-fatal
    console.warn("[backup] Prune failed:", pruneErr.message);
  }
}

// ─── Deferred deletion queue ──────────────────────────────────────────────────
// Processes accounts scheduled for full deletion 6 months after the deletion
// request. Files live in Supabase Storage under deletion-queue/{userId}.json.

async function _processDeletionQueue(supabaseUrl, supabaseKey) {
  const listRes = await fetch(
    `${supabaseUrl}/storage/v1/object/list/receipts`,
    {
      method: "POST",
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "deletion-queue/", limit: 100 }),
    }
  );

  if (!listRes.ok) return;
  const files = await listRes.json();
  if (!Array.isArray(files) || !files.length) return;

  const now = Date.now();

  for (const file of files) {
    try {
      const fileRes = await fetch(
        `${supabaseUrl}/storage/v1/object/receipts/deletion-queue/${file.name}`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (!fileRes.ok) continue;

      const record = await fileRes.json();
      if (!record.userId || !record.deleteAt) continue;

      if (now < new Date(record.deleteAt).getTime()) continue; // Not yet due

      // Delete the Supabase Auth user (final, irreversible step)
      const deleteRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${record.userId}`,
        {
          method: "DELETE",
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        }
      );

      if (deleteRes.ok || deleteRes.status === 404) {
        // Remove the queue file
        await fetch(
          `${supabaseUrl}/storage/v1/object/receipts`,
          {
            method: "DELETE",
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prefixes: [`deletion-queue/${file.name}`] }),
          }
        );
        console.log(`[deletion-queue] Purged auth user ${record.userId} (requested: ${record.requestedAt})`);
      }
    } catch (fileErr) {
      console.warn(`[deletion-queue] Failed to process ${file.name}:`, fileErr.message);
    }
  }
}
