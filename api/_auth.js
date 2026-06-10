// api/_auth.js - shared JWT verification helper (SEG-14).
// Underscore prefix: Vercel does NOT deploy this as a serverless function,
// so it does not count toward the Hobby plan function limit.
//
// Usage:
//   const { requireUser } = require("./_auth");
//   const user = await requireUser(req, res);
//   if (!user) return; // 401 already sent

async function requireUser(req, res) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Server not configured" });
    return null;
  }

  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      res.status(401).json({ error: "Invalid or expired session" });
      return null;
    }
    const user = await r.json();
    if (!user?.id) {
      res.status(401).json({ error: "Invalid token" });
      return null;
    }
    return user; // { id, email, ... }
  } catch (err) {
    console.error("requireUser error:", err.message);
    res.status(500).json({ error: "Auth check failed" });
    return null;
  }
}

module.exports = { requireUser };
