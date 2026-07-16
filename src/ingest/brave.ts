// Source `search` via Brave Search API (les cibles sans RSS: Cursor, Codex,
// Free-Work, APEC). Voir SOURCES.md. Nécessite BRAVE_API_KEY.
import type { Env, RawItem } from "../types";

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

function parseDate(s: unknown): string | undefined {
  if (typeof s !== "string") return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

// Recherche web, fenêtre 7 jours (freshness=pw). Renvoie [] sans clé.
export async function fetchBrave(env: Env, query: string, count = 10): Promise<RawItem[]> {
  if (!env.BRAVE_API_KEY) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&count=${Math.min(count, 20)}&freshness=pw`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": env.BRAVE_API_KEY },
  });
  if (!res.ok) throw new Error(`Brave ${res.status}: ${(await res.text()).slice(0, 150)}`);

  const data = (await res.json()) as { web?: { results?: any[] } };
  return (data.web?.results ?? [])
    .map((r): RawItem => ({
      url: r.url,
      titre: r.title,
      resume: r.description,
      date_pub: parseDate(r.page_age) ?? parseDate(r.age),
    }))
    .filter((i) => i.url && i.titre);
}
