// Vercel serverless function - returns a personal Siri token for the authenticated user
// GET /api/siri-token
// Requires: Authorization: Bearer <supabase_access_token>
//
// Required env vars:
//   SIRI_TOKEN_SECRET    - any random 32+ char string you choose (set once in Vercel dashboard)
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createHmac } from "crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tokenSecret = process.env.SIRI_TOKEN_SECRET;

  if (!supabaseUrl || !supabaseKey || !tokenSecret) {
    return res.status(500).json({ error: "Server not configured - set SIRI_TOKEN_SECRET in Vercel env vars" });
  }

  // Verify the user's Supabase JWT
  const authHeader = req.headers.authorization || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return res.status(401).json({ error: "Missing Authorization header" });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!userRes.ok) return res.status(401).json({ error: "Invalid or expired session" });

  const { id: userId } = await userRes.json();
  if (!userId) return res.status(401).json({ error: "Could not identify user" });

  // Generate a stable per-user HMAC token
  const hmac = createHmac("sha256", tokenSecret).update(userId).digest("hex").slice(0, 32);
  const token = `${userId}.${hmac}`;

  return res.status(200).json({ token });
}
