// Orchestrateur curation — étages 3 & 4. Voir SPEC.md §6-7.
// Traite les items deuwi/both statut=retenu SANS verdict. Cap par run (budget mini).
import type { Env } from "../types";
import { askJson } from "../llm/anthropic";
import { fetchSourceText } from "./fetch-source";
import { SCORE_SYSTEM, scoreUser, DRAFT_SYSTEM, draftUser } from "./prompts";

interface ScoreOut {
  pertinent: boolean;
  chapitre: number | null;
  profil: string | null;
  chiffres_flag: "ok" | "a_verifier" | "inconnu";
  score: number;
}
interface DraftOut {
  fait: string;
  angle: string;
  sources_line: string;
}

interface ItemRow {
  id: number; url: string; titre: string; resume: string | null; date_pub: string | null;
}

export interface CurateReport {
  candidats: number;
  traites: number;
  pertinents: number;
  rejetes: number;
  fetch_echecs: number;
  drafts: number;
  errors: { item: number; error: string }[];
}

export async function runCurate(env: Env, limit = 15): Promise<CurateReport> {
  const { results } = await env.DB.prepare(
    `SELECT i.id, i.url, i.titre, i.resume, i.date_pub
     FROM items i
     LEFT JOIN verdicts v ON v.item_id = i.id
     WHERE i.statut='retenu' AND (i.flux='deuwi' OR i.flux='both') AND v.item_id IS NULL
     ORDER BY i.date_pub DESC
     LIMIT ?`
  ).bind(limit).all<ItemRow>();

  const report: CurateReport = {
    candidats: results.length, traites: 0, pertinents: 0, rejetes: 0,
    fetch_echecs: 0, drafts: 0, errors: [],
  };

  for (const it of results) {
    try {
      // Étage 3 — fetch source complète (obligatoire) + score
      const fetched = await fetchSourceText(it.url);
      const contenu = fetched ?? it.resume ?? it.titre;
      if (!fetched) report.fetch_echecs++;

      const score = await askJson<ScoreOut>(env, SCORE_SYSTEM, scoreUser(it.titre, contenu));

      // stocke contenu récupéré + verdict
      if (fetched) {
        await env.DB.prepare("UPDATE items SET contenu=? WHERE id=?").bind(fetched, it.id).run();
      }
      await env.DB.prepare(
        `INSERT INTO verdicts (item_id, pertinent, chapitre, profil, chiffres_flag, score, raw_llm)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET
           pertinent=excluded.pertinent, chapitre=excluded.chapitre, profil=excluded.profil,
           chiffres_flag=excluded.chiffres_flag, score=excluded.score, raw_llm=excluded.raw_llm`
      ).bind(
        it.id, score.pertinent ? 1 : 0, score.chapitre, score.profil,
        score.chiffres_flag, score.score, JSON.stringify(score)
      ).run();
      report.traites++;

      if (!score.pertinent) {
        await env.DB.prepare("UPDATE items SET statut='rejete', raison_rejet='llm-hors-these' WHERE id=?").bind(it.id).run();
        report.rejetes++;
        continue;
      }
      report.pertinents++;

      // Étage 4 — draft angle
      const draft = await askJson<DraftOut>(
        env, DRAFT_SYSTEM,
        draftUser(it.titre, it.url, it.date_pub, score.chapitre, score.profil, contenu)
      );
      await env.DB.prepare(
        `INSERT INTO drafts (item_id, fait, angle, sources_line, statut, edite_le)
         VALUES (?, ?, ?, ?, 'brouillon', datetime('now'))
         ON CONFLICT(item_id) DO UPDATE SET
           fait=excluded.fait, angle=excluded.angle, sources_line=excluded.sources_line`
      ).bind(it.id, draft.fait, draft.angle, draft.sources_line).run();

      await env.DB.prepare("UPDATE items SET statut='cure' WHERE id=?").bind(it.id).run();
      report.drafts++;
    } catch (e) {
      report.errors.push({ item: it.id, error: String(e) });
    }
  }

  return report;
}
