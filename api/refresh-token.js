// Vercel serverless function - /api/refresh-token
//
// Exchanges a Google OAuth refresh token for a fresh access token.
// Called by the client before every Google Calendar operation when the
// session's provider_token is stale (i.e. on any page load after the first).
//
// Request:  POST with Authorization: Bearer <supabase_access_token>
// Response: { access_token: "...", expires_in: 3599 }
//           or { error: "..." } with a 4xx/5xx status

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ─── Auth: require a valid Supabase session token ─────────────────────────
  const authHeader = req.headers.authorization || "";
  const sessionToken = authHeader.replace("Bearer ", "").trim();
  if (!sessionToken) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Server misconfigured: missing Supabase env vars" });
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: "Server misconfigured: missing Google OAuth env vars. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Vercel environment variables." });
  }

  // ─── Verify the session token and resolve the user ID ─────────────────────
  // Use the Supabase REST /auth/v1/user endpoint with the user's JWT.
  // The service role key is NOT needed for this call - the JWT itself authenticates it.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!userRes.ok) {
    return res.status(401).json({ error: "Invalid or expired session token" });
  }

  const user = await userRes.json();
  const userId = user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Could not resolve user from token" });
  }

  // ─── Fetch the stored refresh token via service role (bypasses RLS) ───────
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=provider_refresh_token`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    }
  );

  if (!profileRes.ok) {
    const err = await profileRes.text();
    return res.status(500).json({ error: "Could not read profile: " + err });
  }

  const profiles = await profileRes.json();
  const refreshToken = profiles?.[0]?.provider_refresh_token;

  if (!refreshToken) {
    return res.status(404).json({
      error: "no_refresh_token",
      message: "User has not granted Google Calendar access yet. Sign in with Google to enable calendar sync.",
    });
  }

  // ─── Exchange refresh token with Google ───────────────────────────────────
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Google token refresh failed:", tokenData);

      // If the refresh token was revoked, clear it from the DB so we don't
      // keep trying with a dead token.
      if (tokenData.error === "invalid_grant") {
        await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ provider_refresh_token: null }),
          }
        );

        return res.status(401).json({
          error: "token_revoked",
          message: "Google access was revoked. Please sign in with Google again to re-enable calendar sync.",
        });
      }

      return res.status(502).json({ error: "Google token exchange failed: " + tokenData.error });
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in || 3599,
    });
  } catch (err) {
    console.error("refresh-token error:", err);
    return res.status(500).json({ error: "Token refresh failed: " + err.message });
  }
}
