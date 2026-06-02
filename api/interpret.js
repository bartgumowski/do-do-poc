// Vercel serverless function - calls Claude to interpret card text into structured fields
// Keeps the API key server-side, never exposed to the browser.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, childNames, parentAName, parentBName } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: "No text provided" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI not configured" });

  const peopleContext = [
    parentAName ? `Parent A is named ${parentAName}` : null,
    parentBName ? `Parent B is named ${parentBName}` : null,
    childNames?.length ? `Children: ${childNames.join(", ")}` : null,
  ].filter(Boolean).join(". ");

  const prompt = `You are a family coordination assistant. Extract structured fields from this co-parenting note.
${peopleContext ? `\nFamily context: ${peopleContext}` : ""}

Note: "${text}"

Return a single JSON object with these fields. Omit any field you are not confident about.

{
  "title": "concise action title, max 72 chars, imperative form (e.g. 'Pick up Leo at 15:00')",
  "topic": one of exactly: "Schedule" | "School" | "Medical" | "Expenses" | "General",
  "type": one of exactly: "Task" | "Event" | "Expense" | "Request" | "Info Only",
  "status": one of exactly: "Important" | "Waiting" | "To Do",
  "due": "ISO 8601 datetime string if a specific date/time is mentioned, null otherwise",
  "amount": "numeric string without currency symbol if an amount is mentioned, e.g. '72.40'",
  "assignee": one of exactly: "Parent A" | "Parent B" | "Both" | "",
  "child": "child's first name if a specific child is mentioned, empty string otherwise",
  "details": "the original note cleaned up and rephrased as a clear coordination note"
}

Rules:
- title must be an action, not a description
- If the note is a question or needs a response, type should be "Request" and status "Waiting"
- If it mentions money/cost/invoice/receipt, type is "Expense" and topic is "Expenses"
- If it mentions a doctor/medication/health, topic is "Medical"
- If it mentions school/teacher/homework/class, topic is "School"
- For "due": today is ${new Date().toISOString().split("T")[0]}. Resolve relative dates like "tomorrow", "next Friday" to actual dates.
- Return ONLY valid JSON, no markdown, no explanation.`;

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
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "AI request failed" });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text?.trim() || "";

    // Strip markdown code blocks if present
    const cleaned = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let fields;
    try {
      fields = JSON.parse(cleaned);
    } catch {
      return res.status(200).json({ details: text });
    }

    return res.status(200).json(fields);
  } catch (err) {
    console.error("interpret error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
