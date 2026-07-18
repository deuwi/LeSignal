// Écriture automatique des signaux Google Trends dans la base Notion dédiée
// « 🔎 Signaux Trends », en fin d'ingestion Trends, SANS supervision humaine.
//
// Garde-fous (personne ne relit avant écriture) :
// - statut par défaut « à trier » (rien n'est présenté comme validé) ;
// - anti-doublon : si une entrée existe déjà pour ce signal ce jour-là, on la
//   met à jour (sans toucher au Statut, qui a pu être trié à la main) ;
// - fail-soft : tout échec Notion est loggé et renvoyé, jamais throw — le reste
//   du batch continue.
//
// Réutilise l'intégration existante (NOTION_TOKEN), partagée aussi avec cette
// base ; seul l'ID de base diffère (NOTION_BANC_DB_ID). Pas de second token.
import type { Env } from "../types";
import type { TrendSignal } from "../ingest/trends";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

export interface TrendWriteResult {
  query: string;
  action: "created" | "updated" | "skipped" | "error";
  error?: string;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": VERSION,
    "content-type": "application/json",
  };
}

function trendUrl(s: TrendSignal): string {
  return `https://trends.google.com/trends/explore?q=${encodeURIComponent(s.query)}&geo=${s.geo}&date=now%207-d`;
}

// Propriétés communes (hors Statut, qu'on ne réécrit pas sur update).
function commonProps(s: TrendSignal, dateOnly: string): Record<string, unknown> {
  return {
    "Type": { select: { name: s.breakout ? "breakout" : "en hausse" } },
    "Requête liée": { rich_text: [{ text: { content: (s.seed || "").slice(0, 2000) } }] },
    "Lien": { url: trendUrl(s) },
    "Date": { date: { start: dateOnly } },
    // Chapitre laissé vide : pas déterminable automatiquement, on ne devine pas.
  };
}

// Écrit un signal (create si absent, update si présent ce jour-là). Ne throw jamais.
export async function writeTrendSignal(env: Env, s: TrendSignal, dateOnly: string): Promise<TrendWriteResult> {
  const token = env.NOTION_TOKEN, db = env.NOTION_BANC_DB_ID;
  if (!token || !db) {
    return { query: s.query, action: "skipped", error: "NOTION_TOKEN / NOTION_BANC_DB_ID absents" };
  }
  try {
    // 1) anti-doublon : même Signal (titre) ET même Date.
    const q = await fetch(`${API}/databases/${db}/query`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        page_size: 1,
        filter: {
          and: [
            { property: "Signal", title: { equals: s.query } },
            { property: "Date", date: { equals: dateOnly } },
          ],
        },
      }),
    });
    if (!q.ok) throw new Error(`query ${q.status}: ${(await q.text()).slice(0, 200)}`);
    const existing = ((await q.json()) as { results?: { id: string }[] }).results ?? [];

    if (existing.length) {
      // 2a) update — on rafraîchit les métadonnées, on NE touche PAS au Statut.
      const r = await fetch(`${API}/pages/${existing[0].id}`, {
        method: "PATCH",
        headers: headers(token),
        body: JSON.stringify({ properties: commonProps(s, dateOnly) }),
      });
      if (!r.ok) throw new Error(`update ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return { query: s.query, action: "updated" };
    }

    // 2b) create — statut « à trier » par défaut.
    const r = await fetch(`${API}/pages`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        parent: { database_id: db },
        properties: {
          "Signal": { title: [{ text: { content: s.query.slice(0, 2000) } }] },
          "Statut": { select: { name: "à trier" } },
          "Source": { select: { name: "Google Trends" } },
          ...commonProps(s, dateOnly),
        },
      }),
    });
    if (!r.ok) throw new Error(`create ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return { query: s.query, action: "created" };
  } catch (e) {
    return { query: s.query, action: "error", error: String(e) };
  }
}

// Écrit un lot de signaux (fail-soft global). Ne throw jamais.
export async function writeTrendSignals(env: Env, signals: TrendSignal[], dateOnly: string): Promise<TrendWriteResult[]> {
  const out: TrendWriteResult[] = [];
  for (const s of signals) out.push(await writeTrendSignal(env, s, dateOnly));
  return out;
}
