/**
 * Live model calls are opt-in. Confidence scoring never reads the model response.
 * Without MOLT_LLM_ENABLED=true and OPENAI_API_KEY, summaries stay in demonstration mode.
 */
export async function maybeEnhanceSummary(deterministic: string, excerpt: string): Promise<{ text: string; mode: "deterministic" | "llm" }> {
  if (process.env.MOLT_LLM_ENABLED !== "true" || !process.env.OPENAI_API_KEY) {
    return { text: deterministic, mode: "deterministic" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "Rewrite the structural note as a plain-language intent statement. Use only what the excerpt supports. Do not invent business rules. Stay under 120 words.",
          },
          { role: "user", content: `Structural note:\n${deterministic}\n\nExcerpt:\n${excerpt.slice(0, 6000)}` },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("empty model response");
    return { text, mode: "llm" };
  } catch {
    return {
      text: `${deterministic} Live model request failed, so this text remains the deterministic reading.`,
      mode: "deterministic",
    };
  }
}
