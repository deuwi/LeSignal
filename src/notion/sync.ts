// Sync fiches validées vers Notion. Upsert via drafts.notion_id. Voir SPEC.md §9.
import type { Env } from "../types";
import { createPage, updatePage, type NotionProps } from "./client";

interface Row {
  item_id: number;
  fait: string; angle: string; notion_id: string | null;
  url: string; date_pub: string | null;
  chapitre: number | null; profil: string | null; chiffres_flag: string | null;
}

export interface SyncReport {
  candidats: number;
  crees: number;
  maj: number;
  errors: { item: number; error: string }[];
}

export async function runNotionSync(env: Env, onlyItemId?: number): Promise<SyncReport> {
  if (!env.NOTION_TOKEN || !env.NOTION_DB_ID) {
    throw new Error("NOTION_TOKEN / NOTION_DB_ID absents (voir .dev.vars)");
  }

  const q = onlyItemId
    ? env.DB.prepare(rowsSql("AND d.item_id=?")).bind(onlyItemId)
    : env.DB.prepare(rowsSql(""));
  const { results } = await q.all<Row>();

  const report: SyncReport = { candidats: results.length, crees: 0, maj: 0, errors: [] };

  for (const r of results) {
    const props: NotionProps = {
      fait: r.fait, angle: r.angle, chapitre: r.chapitre, profil: r.profil,
      chiffres_flag: r.chiffres_flag, url: r.url, date_pub: r.date_pub,
    };
    try {
      if (r.notion_id) {
        await updatePage(env, r.notion_id, props);
        report.maj++;
      } else {
        const pageId = await createPage(env, props);
        await env.DB.prepare("UPDATE drafts SET notion_id=? WHERE item_id=?").bind(pageId, r.item_id).run();
        report.crees++;
      }
    } catch (e) {
      report.errors.push({ item: r.item_id, error: String(e) });
    }
  }
  return report;
}

function rowsSql(extra: string): string {
  return `SELECT d.item_id, d.fait, d.angle, d.notion_id,
                 i.url, i.date_pub, v.chapitre, v.profil, v.chiffres_flag
          FROM drafts d
          JOIN items i ON i.id=d.item_id
          LEFT JOIN verdicts v ON v.item_id=d.item_id
          WHERE d.statut='valide' ${extra}`;
}
