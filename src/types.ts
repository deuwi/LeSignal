export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  FRESHNESS_DAYS: string;
  // secrets (phases suivantes) — absents en Phase 1
  ANTHROPIC_API_KEY?: string;
  NOTION_TOKEN?: string;
  NOTION_DB_ID?: string;
  FT_CLIENT_ID?: string;
  FT_CLIENT_SECRET?: string;
}

export type Flux = "dev" | "deuwi" | "both";
export type SourceType = "rss" | "atom" | "api" | "search" | "scrape";

export interface Source {
  id: number;
  type: SourceType;
  nom: string;
  url: string;
  flux: Flux;
  rank: number;
  config: string | null;
  actif: number;
  last_run: string | null;
}

// Item brut extrait d'une source, avant insertion
export interface RawItem {
  url: string;
  titre: string;
  resume?: string;
  date_pub?: string; // ISO
}
