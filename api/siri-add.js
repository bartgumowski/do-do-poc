// Vercel serverless function - creates a card from Siri / Apple Shortcuts
// POST /api/siri-add
// Body: { "title": "...", "details": "...", "token": "<user-token-from-siri-token-endpoint>" }
//
// Required env vars (set once in Vercel dashboard):
//   SIRI_TOKEN_SECRET    - same secret used in siri-token.js
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createHmac } from "crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { title, details = "", token } = req.body || {};

  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  if (!token) return res.status(401).json({ error: "token is required" });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tokenSecret = process.env.SIRI_TOKEN_SECRET;

  if (!supabaseUrl || !supabaseKey || !tokenSecret) {
    return res.status(500).json({ error: "Server not configured" });
  }

  // Validate token: format is {userId}.{hmac}
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return res.status(401).json({ error: "Invalid token format" });

  const userId = token.slice(0, dotIdx);
  const providedHmac = token.slice(dotIdx + 1);
  const expectedHmac = createHmac("sha256", tokenSecret).update(userId).digest("hex").slice(0, 32);

  if (providedHmac !== expectedHmac) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Look up pair_id from profiles table
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=pair_id`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  if (!profileRes.ok) {
    return res.status(500).json({ error: "Could not look up user profile" });
  }

  const profiles = await profileRes.json();
  const pairId = profiles?.[0]?.pair_id;

  if (!pairId) {
    return res.status(400).json({ error: "User has no active family workspace" });
  }

  // Insert the card
  const id = crypto.randomUUID();
  const now = Date.now();

  const card = {
    id,
    pair_id: pairId,
    created_by: userId,
    updated_by: userId,
    title: title.trim(),
    body: details.trim() || null,
    topic: "schedule",
    card_type: "task",
    status: "todo",
    assigned_to: "unassigned",
    child_label: null,
    due_at: null,
    amount: null,
    payment_status: "none",
    metadata: {
      comments: [],
      reminder: null,
      googleCalendar: null,
      acknowledged: false,
      createdAt: now,
      source: "siri",
    },
  };

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/cards`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(card),
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error("Supabase insert error:", err);
    return res.status(500).json({ error: "Failed to create card" });
  }

  return res.status(201).json({ ok: true, id, title: title.trim() });
}
