// Client minimal Anthropic Messages API (Workers fetch). Haiku 4.5, budget mini.
import type { Env } from "../types";

const MODEL = "claude-haiku-4-5-20251001";
const ENDPOINT = "https://api.anthropic.com/v1/messages";

// Appelle Haiku et renvoie le JSON parsé de la réponse.
// La réponse est forcée en JSON via instruction stricte + extraction défensive.
export async function askJson<T>(
  env: Env,
  system: string,
  user: string,
  maxTokens = 700
): Promise<T> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY absent (voir .dev.vars)");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content?.map((b) => b.text ?? "").join("") ?? "";
  return extractJson<T>(text);
}

function extractJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error(`Réponse LLM non-JSON: ${text.slice(0, 200)}`);
  }
}
