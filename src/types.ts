export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  FRESHNESS_DAYS: string;
  RETENTION_DAYS?: string; // purge des items plus vieux (défaut 7j)
  // secrets (phases suivantes) — absents en Phase 1
  ANTHROPIC_API_KEY?: string;
  NOTION_TOKEN?: string;
  NOTION_DB_ID?: string;
  ADMIN_TOKEN?: string;   // protège les actions d'écriture (app publique)
  BRAVE_API_KEY?: string; // sources `search` (Brave Search API)
  FT_CLIENT_ID?: string;
  FT_CLIENT_SECRET?: string;
  // Base Notion dédiée « Signaux Trends ». Réutilise NOTION_TOKEN (intégration
  // existante, partagée aussi avec cette base) ; seul l'ID de base diffère.
  // Abandonnée : plus appelée (remplacée par la sortie Google Sheet ci-dessous).
  NOTION_BANC_DB_ID?: string;
  // Sortie des signaux Trends vers Google Sheet (remplace Notion).
  GOOGLE_SA_KEY?: string; // JSON du service account (secret)
  SHEETS_ID?: string;     // id du spreadsheet cible (secret)
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
