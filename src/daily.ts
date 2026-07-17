// Passe quotidienne unique (cron): ingest → lecture Notion → curate (exclusion) → masquage.
import type { Env } from "./types";
import { runIngest } from "./ingest";
import { runCurate } from "./curate";
import { runTranslate } from "./curate/translate";
import { listNotionUrls, markDraftsInNotion } from "./notion/client";
import { purgeOld } from "./purge";
import { stamp } from "./state";

export async function runDaily(env: Env) {
  // Stamp en début de passe: garde-fou fiable + anti-chevauchement,
  // même si la requête HTTP est coupée avant la fin.
  await stamp(env, "daily");

  // Rétention: purge des items plus vieux que RETENTION_DAYS (défaut 7j) avant
  // de réingérer. La veille ne garde que le frais.
  const purge = await purgeOld(env, Number(env.RETENTION_DAYS ?? "7") || 7);

  const ingest = await runIngest(env);

  let notion = new Set<string>();
  let notionError: string | null = null;
  try {
    notion = await listNotionUrls(env);
  } catch (e) {
    notionError = String(e); // Notion indispo → on continue sans exclusion
  }

  const curate = await runCurate(env, 40, notion);
  const translate = await runTranslate(env, 60);
  const masquees = await markDraftsInNotion(env, notion);

  return { purge, ingest, curate, translate, notion_urls: notion.size, notion_error: notionError, masquees };
}
