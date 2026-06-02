// Vercel serverless function - generates AI daily summary using Claude

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { cards, parentName, coparentName, childNames } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI not configured" });

  const urgent = (cards || []).filter((c) => ["Important", "Waiting"].includes(c.status) && !c.acknowledged);
  const dueToday = (cards || []).filter((c) => {
    if (!c.due) return false;
    const d = new Date(c.due);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todo = (cards || []).filter((c) => c.status === "To Do").length;

  const cardSummary = [...urgent, ...dueToday]
    .slice(0, 8)
    .map((c) => `- ${c.title} [${c.status}${c.due ? `, due ${new Date(c.due).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}]`)
    .join("\n") || "No urgent items.";

  const prompt = `You are a family coordination assistant. Write a brief, warm daily briefing (2-3 sentences max) for ${parentName || "a parent"} coordinating with ${coparentName || "their co-parent"}${childNames?.length ? ` for ${childNames.join(" and ")}` : ""}.

Current board status:
- ${urgent.length} item(s) need response
- ${dueToday.length} due today
- ${todo} to do

Key items:
${cardSummary}

Write a natural, concise briefing. Be direct and practical. No emojis. Start with the most important thing.`;

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
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim() || "";
    return res.status(200).json({ summary: text });
  } catch (err) {
    return res.status(500).json({ error: "AI unavailable" });
  }
}
