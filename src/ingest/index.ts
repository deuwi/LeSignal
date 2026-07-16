// Orchestrateur d'ingestion — étages 1 & 2. Voir SPEC.md §3.
// Phase 1: rss/atom + api(HN). Types search/scrape/francetravail = skip (actif=0 en seed).
import type { Env, Source, RawItem, Flux } from "../types";
import { fetchFeed } from "./feeds";
import { fetchHN } from "./hn";
import { fetchBrave } from "./brave";
import { fetchFranceTravail } from "../ft/offres";
import { ranWithin, stamp } from "../state";
import { itemHash } from "./dedup";
import { filterItem, categorize, compile } from "./filter";
import { extractLinks, stripTags } from "./links";
import { loadConfig } from "../config";

export interface RunReport {
  sources: number;
  fetched: number;
  inserted: number;
  duplicates: number;
  retenu: number;
  rejete: number;
  errors: { source: string; error: string }[];
}

export async function runIngest(env: Env, onlySourceId?: number): Promise<RunReport> {
  const now = Date.now();
  const cfg = compile(await loadConfig(env));

  const q = onlySourceId
    ? env.DB.prepare("SELECT * FROM sources WHERE actif=1 AND id=?").bind(onlySourceId)
    : env.DB.prepare("SELECT * FROM sources WHERE actif=1");
  const { results } = await q.all<Source>();

  const report: RunReport = {
    sources: results.length,
    fetched: 0, inserted: 0, duplicates: 0, retenu: 0, rejete: 0, errors: [],
  };

  for (const src of results) {
    let raw: RawItem[] = [];
    try {
      raw = await fetchSource(src, env);
    } catch (e) {
      report.errors.push({ source: src.nom, error: String(e) });
      continue;
    }
    report.fetched += raw.length;

    // Prépare tous les INSERT, puis batch par lots (1 sous-requête / lot).
    // Workers plafonne les sous-requêtes par invocation (~1000): un INSERT par
    // item épuisait le quota avant les sources both/deuwi. Le batch règle ça.
    const insert = env.DB.prepare(
      `INSERT INTO items (source_id, url, titre, resume, date_pub, hash, flux, statut, raison_rejet, categories, links)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(hash) DO NOTHING`
    );
    const stmts: D1PreparedStatement[] = [];
    const statuts: string[] = [];
    for (const item of raw) {
      const hash = await itemHash(item.url, item.titre);
      const flux = src.flux as Flux;
      const rawResume = item.resume ?? "";
      const verdict = filterItem(item.titre, rawResume, item.date_pub, flux, cfg, now);
      const cats = categorize(item.titre, rawResume, cfg);
      const links = extractLinks(rawResume, item.url);
      const resumeClean = stripTags(rawResume).slice(0, 600) || null;
      stmts.push(insert.bind(
        src.id, item.url, item.titre, resumeClean, item.date_pub ?? null,
        hash, flux, verdict.statut, verdict.raison ?? null,
        cats.length ? JSON.stringify(cats) : null,
        links.length ? JSON.stringify(links) : null
      ));
      statuts.push(verdict.statut);
    }

    const CHUNK = 50;
    for (let i = 0; i < stmts.length; i += CHUNK) {
      try {
        const res = await env.DB.batch(stmts.slice(i, i + CHUNK));
        res.forEach((r, j) => {
          if (r.meta.changes > 0) {
            report.inserted++;
            statuts[i + j] === "retenu" ? report.retenu++ : report.rejete++;
          } else {
            report.duplicates++;
          }
        });
      } catch (e) {
        report.errors.push({ source: src.nom, error: `batch: ${e}` });
      }
    }

    await env.DB.prepare("UPDATE sources SET last_run=datetime('now') WHERE id=?").bind(src.id).run();
  }

  return report;
}

async function fetchSource(src: Source, env: Env): Promise<RawItem[]> {
  switch (src.type) {
    case "rss":
    case "atom":
      return fetchFeed(src.url);
    case "search": {
      const cfg = src.config ? JSON.parse(src.config) : {};
      if (!cfg.query) return [];
      return fetchBrave(env, cfg.query);
    }
    case "api": {
      const cfg = src.config ? JSON.parse(src.config) : {};
      if (cfg.kind === "hn") {
        const now = Date.now();
        const since = Math.floor((now - 7 * 86_400_000) / 1000);
        return fetchHN(cfg, since);
      }
      if (cfg.kind === "francetravail") {
        // Volumes mensuels → passe mensuelle (évite le spam quotidien).
        if (await ranWithin(env, "ft", 25 * 24)) return [];
        const codes: string[] = cfg.romeCodes ?? ["M1805", "M1802", "M1810", "M1806"];
        const items = await fetchFranceTravail(env, codes, new Date().toISOString());
        await stamp(env, "ft");
        return items;
      }
      return [];
    }
    // scrape — non couvert (contenu JS, cf. SOURCES.md)
    default:
      return [];
  }
}
