// Parse RSS 2.0 + Atom. Voir SOURCES.md.
import { XMLParser } from "fast-xml-parser";
import type { RawItem } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // Désactive l'expansion d'entités du parser (plafond anti-DoS à 1000/doc
  // dépassé par les gros feeds). On décode les entités courantes nous-mêmes.
  processEntities: false,
});

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&apos;": "'", "&#39;": "'", "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

const UA = "veille-bot/0.1 (+https://github.com/deuwi/veille)";

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// Un champ texte peut être string ou { "#text": ... }
function txt(v: unknown): string {
  if (v == null) return "";
  let s: string;
  if (typeof v === "string") s = v;
  else if (typeof v === "object" && "#text" in (v as any)) s = String((v as any)["#text"]);
  else s = String(v);
  return decodeEntities(s);
}

export async function fetchFeed(url: string): Promise<RawItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  const xml = await res.text();
  const doc = parser.parse(xml);

  // RSS 2.0 — content:encoded (HTML riche) prioritaire sur description pour les liens
  if (doc?.rss?.channel) {
    return asArray(doc.rss.channel.item).map((it: any): RawItem => ({
      url: txt(it.link),
      titre: txt(it.title),
      resume: txt(it["content:encoded"]) || txt(it.description),
      date_pub: parseDate(txt(it.pubDate) || txt(it["dc:date"])),
    })).filter((i: RawItem) => i.url && i.titre);
  }

  // Atom
  if (doc?.feed) {
    return asArray(doc.feed.entry).map((e: any): RawItem => ({
      url: atomLink(e.link),
      titre: txt(e.title),
      resume: txt(e.summary) || txt(e.content),
      date_pub: parseDate(txt(e.updated) || txt(e.published)),
    })).filter((i: RawItem) => i.url && i.titre);
  }

  throw new Error(`Format de feed non reconnu: ${url}`);
}

function atomLink(link: any): string {
  const links = asArray(link);
  // priorité rel=alternate, sinon premier href
  const alt = links.find((l) => l?.["@_rel"] === "alternate") ?? links[0];
  if (typeof alt === "string") return alt;
  return alt?.["@_href"] ?? "";
}

function parseDate(s: string): string | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}
