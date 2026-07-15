// Étage 2 — pré-filtre heuristique, 0 token. Piloté par la config (SPEC §5).
import type { Flux } from "../types";
import type { Config } from "../config";

export interface Compiled {
  exclusions: { re: RegExp; tag: string }[];
  these: RegExp | null;
  categories: { re: RegExp; name: string }[];
  freshnessDays: number;
}

// Compile les regex de la config une fois par passe.
export function compile(cfg: Config): Compiled {
  const safe = (p: string) => {
    try { return new RegExp(p, "i"); } catch { return null; }
  };
  return {
    exclusions: cfg.exclusions.map((e) => ({ re: safe(e.pattern), tag: e.tag }))
      .filter((e): e is { re: RegExp; tag: string } => e.re !== null),
    these: cfg.these_keywords ? safe(cfg.these_keywords) : null,
    categories: cfg.categories.map((c) => ({ re: safe(c.keywords), name: c.name }))
      .filter((c): c is { re: RegExp; name: string } => c.re !== null),
    freshnessDays: cfg.freshness_days,
  };
}

export interface FilterResult {
  statut: "retenu" | "rejete";
  raison?: string;
}

export function filterItem(
  titre: string,
  resume: string | undefined,
  datePub: string | undefined,
  flux: Flux,
  c: Compiled,
  now: number
): FilterResult {
  const text = `${titre} ${resume ?? ""}`;

  // 1. Fraîcheur
  if (datePub) {
    const t = Date.parse(datePub);
    if (!Number.isNaN(t) && (now - t) / 86_400_000 > c.freshnessDays) {
      return { statut: "rejete", raison: "hors-fraicheur" };
    }
  }

  // 2. Exclusions dures
  for (const e of c.exclusions) {
    if (e.re.test(text)) return { statut: "rejete", raison: `exclusion:${e.tag}` };
  }

  // 3. Pertinence thèse — flux deuwi uniquement (le flux dev garde tout)
  if (flux === "deuwi" && c.these && !c.these.test(text)) {
    return { statut: "rejete", raison: "hors-these" };
  }

  return { statut: "retenu" };
}

// Catégories dev correspondant à l'item (peut être vide).
export function categorize(titre: string, resume: string | undefined, c: Compiled): string[] {
  const text = `${titre} ${resume ?? ""}`;
  return c.categories.filter((cat) => cat.re.test(text)).map((cat) => cat.name);
}
