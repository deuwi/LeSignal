// Notion en LECTURE SEULE: récupère les URLs déjà présentes pour exclusion.
// Voir SPEC.md §9. L'app n'écrit plus dans Notion (copier-coller manuel).
import type { Env } from "../types";
import { normalizeUrl } from "../ingest/dedup";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

function headers(env: Env) {
  return {
    Authorization: `Bearer ${env.NOTION_TOKEN}`,
    "Notion-Version": VERSION,
    "content-type": "application/json",
  };
}

// Ensemble des URLs (normalisées) présentes dans la base Notion, propriété "Source".
export async function listNotionUrls(env: Env): Promise<Set<string>> {
  const urls = new Set<string>();
  if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) return urls;

  let cursor: string | undefined;
  do {
    const res = await fetch(`${API}/databases/${env.NOTION_DB_ID}/query`, {
      method: "POST",
      headers: headers(env),
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!res.ok) throw new Error(`Notion query ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { results: any[]; has_more: boolean; next_cursor: string | null };
    for (const page of data.results ?? []) {
      const u = page.properties?.["Source"]?.url;
      if (u) urls.add(normalizeUrl(u));
    }
    cursor = data.has_more ? data.next_cursor ?? undefined : undefined;
  } while (cursor);

  return urls;
}

// Marque les fiches (drafts) dont l'URL est déjà sur Notion → masquées de la liste.
export async function markDraftsInNotion(env: Env, urls: Set<string>): Promise<number> {
  if (!urls.size) return 0;
  const { results } = await env.DB.prepare(
    "SELECT d.item_id AS item_id, i.url AS url FROM drafts d JOIN items i ON i.id=d.item_id WHERE d.statut='propose'"
  ).all<{ item_id: number; url: string }>();
  let n = 0;
  for (const r of results) {
    if (urls.has(normalizeUrl(r.url))) {
      await env.DB.prepare("UPDATE drafts SET statut='dans_notion' WHERE item_id=?").bind(r.item_id).run();
      n++;
    }
  }
  return n;
}
