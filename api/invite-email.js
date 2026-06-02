// Vercel serverless function - sends invite email via Resend
// Get a free API key at resend.com (3000 emails/month free)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { toEmail, fromName, inviteLink } = req.body || {};
  if (!toEmail || !inviteLink) return res.status(400).json({ error: "Missing toEmail or inviteLink" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No email service configured - return the link so the app can show it
    return res.status(200).json({ sent: false, reason: "no_email_service", inviteLink });
  }

  const senderName = fromName || "Your co-parent";
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="background: #65d6c6; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: 900; color: white;">D</span>
      </div>
      <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 12px;">You've been invited to Do-Do</h1>
      <p style="color: #78747e; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        <strong>${senderName}</strong> invited you to join their family coordination board on Do-Do.
        Accept to share schedules, messages, expenses, and a calendar in one place.
      </p>
      <a href="${inviteLink}" style="display: inline-block; background: #65d6c6; color: white; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 999px; text-decoration: none;">
        Accept invite
      </a>
      <p style="color: #78747e; font-size: 12px; margin-top: 24px;">
        This link expires in 7 days. If you didn't expect this, you can ignore it.
      </p>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Do-Do <invite@do-do.app>",
        to: [toEmail],
        subject: `${senderName} invited you to Do-Do`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Resend error:", err);
      return res.status(200).json({ sent: false, reason: "send_failed", inviteLink });
    }

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error("invite-email error:", err);
    return res.status(200).json({ sent: false, reason: "error", inviteLink });
  }
}
