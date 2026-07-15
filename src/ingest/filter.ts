// Étage 2 — pré-filtre heuristique, 0 token. Voir SPEC.md §5.
import type { Flux } from "../types";

// Exclusions dures — match = rejet immédiat (BRIQUE).
const EXCLUSIONS: [RegExp, string][] = [
  [/\b(apple|iphone|ipad|macos|vision ?pro|ios\b)/i, "apple"],
  [/\b(formation|devenez|gagnez?\s+\d+\s?k|10\s?000\s?€|freelance à 6 chiffres)/i, "formation-10k"],
  [/\bl'?ia\s+(va|pourrait)\s+(tuer|remplacer|détruire|anéantir)/i, "peur-artificielle"],
  [/\b(élections?|gouvernement|ministre|présidentielle|polémique politique)/i, "politique"],
];

// Pertinence thèse (entrée deuwi) — au moins un signal.
const THESE_KEYWORDS = new RegExp(
  [
    "\\b(ia|ai|llm|gpt|claude|copilot|cursor|codex|agent)",
    "\\b(développeur|developer|dev\\b|ingénieur|engineer|tech lead|programmeur)",
    "\\b(emploi|embauche|recrutement|licenciement|layoff|hiring|job market|marché du travail)",
    "\\b(productivité|productivity|compétence|skill|reconversion|junior|senior)",
    "\\b(automat|code generation|génération de code|pair programming)",
  ].join("|"),
  "i"
);

export interface FilterResult {
  statut: "retenu" | "rejete";
  raison?: string;
}

export function filterItem(
  titre: string,
  resume: string | undefined,
  datePub: string | undefined,
  flux: Flux,
  freshnessDays: number,
  now: number
): FilterResult {
  const text = `${titre} ${resume ?? ""}`;

  // 1. Fraîcheur
  if (datePub) {
    const t = Date.parse(datePub);
    if (!Number.isNaN(t)) {
      const ageDays = (now - t) / 86_400_000;
      if (ageDays > freshnessDays) return { statut: "rejete", raison: "hors-fraicheur" };
    }
  }

  // 2. Exclusions dures
  for (const [re, tag] of EXCLUSIONS) {
    if (re.test(text)) return { statut: "rejete", raison: `exclusion:${tag}` };
  }

  // 3. Pertinence thèse — appliquée au flux deuwi uniquement.
  //    Le flux dev garde tout (curation large côté humain).
  if (flux === "deuwi" && !THESE_KEYWORDS.test(text)) {
    return { statut: "rejete", raison: "hors-these" };
  }

  return { statut: "retenu" };
}
