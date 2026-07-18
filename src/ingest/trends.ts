// Google Trends — signaux related_queries (rising + breakout).
// La RÉCUPÉRATION se fait HORS Worker (script trend_watch.py sur IP résidentielle) :
// depuis une IP datacenter Cloudflare, l'API Trends renvoie le mur anti-bot
// /sorry/ (CAPTCHA). Les signaux sont donc POUSSÉS dans LeSignal via
// POST /api/ingest-trends. Ce module ne fait que le mapping vers le pipeline.
import type { RawItem } from "../types";

export interface TrendSignal {
  seed: string;
  geo: string;
  query: string;
  value: string;   // "Breakout" ou "+250%" (formattedValue)
  breakout: boolean;
}

// Valide/normalise un signal reçu du pusher (défensif : entrée externe).
export function normalizeSignal(x: unknown): TrendSignal | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const query = typeof o.query === "string" ? o.query.trim() : "";
  if (!query) return null;
  const value = typeof o.value === "string" ? o.value : String(o.value ?? "");
  return {
    seed: typeof o.seed === "string" ? o.seed : "",
    geo: typeof o.geo === "string" ? o.geo : "FR",
    query,
    value,
    breakout: o.breakout === true || value.trim().toLowerCase() === "breakout",
  };
}

// Mappe un signal Trends en item du pipeline (même format que les autres sources).
export function trendToRawItem(s: TrendSignal, nowIso: string): RawItem {
  const tag = s.breakout ? "breakout" : `en hausse ${s.value}`;
  return {
    url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(s.query)}&geo=${s.geo}&date=now%207-d`,
    titre: `« ${s.query} » — requête ${tag} (Google Trends, lié à « ${s.seed} », ${s.geo})`,
    resume: `Requête associée ${s.breakout ? "en explosion (Breakout)" : `en hausse (${s.value})`} autour de « ${s.seed} », détectée sur Google Trends (${s.geo}, 7 derniers jours). Signal de recherche émergent.`,
    date_pub: nowIso,
  };
}
