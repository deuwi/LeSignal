// Config pilotable (éditable via onglet Réglages, stockée en DB app_state['config']).
// Remplace les regex codées en dur: tu as la main sur fraîcheur/exclusions/catégories.
import type { Env } from "./types";

export interface Exclusion { tag: string; pattern: string; }
export interface Category { name: string; keywords: string; }

export interface Config {
  freshness_days: number;
  these_keywords: string;      // regex (flux deuwi): pertinence thèse
  exclusions: Exclusion[];     // regex → rejet dur
  categories: Category[];      // regex → tag dev
}

export const DEFAULT_CONFIG: Config = {
  freshness_days: 7,
  these_keywords:
    "\\b(ia|ai|llm|gpt|claude|copilot|cursor|codex|agent)|" +
    "\\b(développeur|developer|dev\\b|ingénieur|engineer|tech lead|programmeur)|" +
    "\\b(emploi|embauche|recrutement|licenciement|layoff|hiring|job market|marché du travail)|" +
    "\\b(productivité|productivity|compétence|skill|reconversion|junior|senior)|" +
    "\\b(automat|code generation|génération de code|pair programming)",
  exclusions: [
    { tag: "apple", pattern: "\\b(apple|iphone|ipad|macos|vision ?pro|ios\\b)" },
    { tag: "formation-10k", pattern: "\\b(formation|devenez|gagnez?\\s+\\d+\\s?k|10\\s?000\\s?€|freelance à 6 chiffres)" },
    { tag: "peur-artificielle", pattern: "\\bl'?ia\\s+(va|pourrait)\\s+(tuer|remplacer|détruire|anéantir)" },
    { tag: "politique", pattern: "\\b(élections?|gouvernement|ministre|présidentielle|polémique politique)" },
  ],
  categories: [
    { name: "Langages/Runtime", keywords: "typescript|javascript|\\brust\\b|golang|\\bgo\\b|python|\\bnode|deno|\\bbun\\b|\\bjava\\b|kotlin|\\bc\\+\\+|zig" },
    { name: "IA outillage", keywords: "\\bia\\b|\\bai\\b|llm|claude|copilot|cursor|codex|\\bagent|\\bmcp\\b|prompt|rag\\b|fine-?tun" },
    { name: "Web/Frontend", keywords: "react|vue|svelte|angular|\\bcss\\b|\\bhtml\\b|next\\.?js|vite|tailwind|webassembly|\\bwasm\\b" },
    { name: "Cloud/Infra", keywords: "cloudflare|\\baws\\b|azure|\\bgcp\\b|kubernetes|docker|serverless|\\bedge\\b|terraform|worker" },
    { name: "Backend/Data", keywords: "database|\\bsql\\b|postgres|sqlite|\\bapi\\b|graphql|redis|kafka|microservice|\\borm\\b" },
    { name: "Sécurité", keywords: "security|sécurité|vulnerab|\\bcve\\b|\\bauth|oauth|crypto|exploit|\\bxss\\b|injection" },
    { name: "DevOps/CI", keywords: "\\bci\\b|\\bcd\\b|github actions|pipeline|deploy|observability|monitoring|\\bsre\\b" },
    { name: "Archi/Fondamentaux", keywords: "architect|design pattern|distributed|\\bperf|scalab|concurren|refactor|\\btest\\b|\\btdd\\b" },
  ],
};

export async function loadConfig(env: Env): Promise<Config> {
  const row = await env.DB.prepare("SELECT value FROM app_state WHERE key='config'").first<{ value: string }>();
  if (!row?.value) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(env: Env, cfg: Config): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO app_state (key, value) VALUES ('config', ?) " +
    "ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(JSON.stringify(cfg)).run();
}
