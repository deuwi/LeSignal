// One-shot: traduit en EN les fiches créées avant le bilingue (fait_en NULL).
import type { Env } from "../types";
import { askJson } from "../llm/anthropic";

const SYSTEM =
  "Traduis fidèlement en anglais naturel. Garde le sens, le ton (factuel, sans hype). " +
  "Si tu vois « À VÉRIFIER », traduis en « TO VERIFY ». " +
  'Réponds UNIQUEMENT un JSON: {"fait_en":"...","angle_en":"..."}';

interface Row { item_id: number; fait: string; angle: string; }
interface Out { fait_en: string; angle_en: string; }

export interface BackfillReport {
  candidats: number;
  traduits: number;
  errors: { item: number; error: string }[];
}

export async function runBackfillEn(env: Env, limit = 40): Promise<BackfillReport> {
  const { results } = await env.DB.prepare(
    "SELECT item_id, fait, angle FROM drafts WHERE fait_en IS NULL OR fait_en='' LIMIT ?"
  ).bind(limit).all<Row>();

  const report: BackfillReport = { candidats: results.length, traduits: 0, errors: [] };

  for (const r of results) {
    try {
      const out = await askJson<Out>(env, SYSTEM, `FAIT: ${r.fait}\n\nANGLE: ${r.angle}`, 900);
      await env.DB.prepare("UPDATE drafts SET fait_en=?, angle_en=? WHERE item_id=?")
        .bind(out.fait_en, out.angle_en, r.item_id).run();
      report.traduits++;
    } catch (e) {
      report.errors.push({ item: r.item_id, error: String(e) });
    }
  }
  return report;
}
