// Vercel serverless function - suggests a plain-language resolution for two conflicting cards.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { cardA, cardB } = req.body || {};
  if (!cardA || !cardB) return res.status(400).json({ error: "Two cards required" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI not configured" });

  const fmt = (card) => {
    const time = card.due
      ? new Date(card.due).toLocaleString("en-GB", {
          weekday: "short", day: "numeric", month: "short",
          hour: "2-digit", minute: "2-digit",
        })
      : "no time set";
    const parts = [
      `"${card.title}"`,
      `at ${time}`,
      card.child ? `(involves ${card.child})` : "",
      card.assignee ? `(assigned to ${card.assignee})` : "",
    ].filter(Boolean);
    return parts.join(" ");
  };

  const prompt = `Two family events overlap in time. Suggest a one-sentence practical resolution.

Event A: ${fmt(cardA)}
Event B: ${fmt(cardB)}

Rules:
- Be specific: name the events and suggest which one to move and when.
- Max 25 words.
- No preamble, no "Consider", just the suggestion directly.
- Example: "Move the dentist to Thursday afternoon - Leo has football every Tuesday at 16:00."`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic ${response.status}`);
    const data = await response.json();
    const suggestion = data.content?.[0]?.text?.trim() || "";
    return res.status(200).json({ suggestion });
  } catch (err) {
    console.error("suggest-resolution error:", err);
    return res.status(500).json({ error: "AI unavailable" });
  }
}
