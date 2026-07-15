// Hacker News via Algolia (gratuit, sans clé). Voir SOURCES.md §API.
import type { RawItem } from "../types";

interface HnConfig {
  queries: string[];
  min_points?: number;
}

export async function fetchHN(cfg: HnConfig, sinceEpoch: number): Promise<RawItem[]> {
  const minPoints = cfg.min_points ?? 50;
  const out: RawItem[] = [];

  for (const q of cfg.queries) {
    const url =
      "https://hn.algolia.com/api/v1/search_by_date?tags=story" +
      `&query=${encodeURIComponent(q)}` +
      `&numericFilters=points>${minPoints},created_at_i>${sinceEpoch}` +
      "&hitsPerPage=30";
    const res = await fetch(url, { headers: { "User-Agent": "veille-bot/0.1" } });
    if (!res.ok) continue;
    const data = (await res.json()) as { hits: any[] };
    for (const h of data.hits ?? []) {
      const link = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
      if (!h.title) continue;
      out.push({
        url: link,
        titre: h.title,
        resume: `HN ${h.points ?? 0} pts, ${h.num_comments ?? 0} comm. — recherche: ${q}`,
        date_pub: h.created_at,
      });
    }
  }
  return out;
}
