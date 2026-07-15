// Parse RSS 2.0 + Atom. Voir SOURCES.md.
import { XMLParser } from "fast-xml-parser";
import type { RawItem } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

const UA = "veille-bot/0.1 (+https://github.com/deuwi/veille)";

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// Un champ texte peut être string ou { "#text": ... }
function txt(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in (v as any)) return String((v as any)["#text"]);
  return String(v);
}

export async function fetchFeed(url: string): Promise<RawItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  const xml = await res.text();
  const doc = parser.parse(xml);

  // RSS 2.0
  if (doc?.rss?.channel) {
    return asArray(doc.rss.channel.item).map((it: any): RawItem => ({
      url: txt(it.link),
      titre: txt(it.title),
      resume: txt(it.description),
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
