// Traduction bilingue des items de la sélection (flux dev). Voir SPEC.md §5.
// Le flux dev n'a pas de LLM de curation: on ajoute ici une passe légère (Haiku)
// qui remplit titre_fr/resume_fr/titre_en/resume_en pour les items affichés (retenu).
import type { Env } from "../types";
import { askJson } from "../llm/anthropic";
import { TRANSLATE_SYSTEM, translateUser } from "./prompts";

interface TranslateOut {
  titre_fr: string;
  resume_fr: string;
  titre_en: string;
  resume_en: string;
}

interface ItemRow {
  id: number; titre: string; resume: string | null;
}

export interface TranslateReport {
  candidats: number;
  traduits: number;
  errors: { item: number; error: string }[];
}

// Traduit les items dev/both retenus non encore traduits (titre_fr IS NULL).
// Cap par run: rattrapage progressif sur les passes quotidiennes.
export async function runTranslate(env: Env, limit = 60): Promise<TranslateReport> {
  const { results } = await env.DB.prepare(
    `SELECT i.id, i.titre, i.resume
     FROM items i
     WHERE i.statut='retenu' AND (i.flux='dev' OR i.flux='both') AND i.titre_fr IS NULL
     ORDER BY i.date_pub DESC
     LIMIT ?`
  ).bind(limit).all<ItemRow>();

  const report: TranslateReport = { candidats: results.length, traduits: 0, errors: [] };

  for (const it of results) {
    try {
      const tr = await askJson<TranslateOut>(env, TRANSLATE_SYSTEM, translateUser(it.titre, it.resume));
      await env.DB.prepare(
        `UPDATE items SET titre_fr=?, resume_fr=?, titre_en=?, resume_en=? WHERE id=?`
      ).bind(
        tr.titre_fr || it.titre,
        tr.resume_fr || (it.resume ?? ""),
        tr.titre_en || it.titre,
        tr.resume_en || (it.resume ?? ""),
        it.id
      ).run();
      report.traduits++;
    } catch (e) {
      report.errors.push({ item: it.id, error: String(e) });
    }
  }

  return report;
}
