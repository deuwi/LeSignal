// Fetch OBLIGATOIRE de la source complète avant écriture (règle BRIQUE, SPEC §6).
import { extractLinks } from "../ingest/links";

const UA = "veille-bot/0.1 (+https://github.com/deuwi/veille)";
const MAX_CHARS = 7000; // borne les tokens Haiku

export interface FetchedSource {
  text: string;
  links: string[];
}

// Récupère texte + liens de référence de la page source. Renvoie null si échec.
export async function fetchSourceText(url: string): Promise<FetchedSource | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" } });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const raw = await res.text();
    const isHtml = ct.includes("html");
    return {
      text: (isHtml ? htmlToText(raw) : raw).slice(0, MAX_CHARS),
      links: isHtml ? extractLinks(raw, url) : [],
    };
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
