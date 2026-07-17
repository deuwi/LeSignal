// Purge de rétention: la veille ne garde que le frais. Les items (et leurs
// verdicts/drafts liés) plus vieux qu'une fenêtre glissante sont supprimés.
// Base = cree_le (date d'entrée en base, format uniforme datetime('now')),
// fiable en SQL contrairement à date_pub (formats de feeds hétérogènes).
import type { Env } from "./types";

export interface PurgeReport {
  jours: number;
  items: number;
}

export async function purgeOld(env: Env, days: number): Promise<PurgeReport> {
  const modifier = `-${Math.max(1, Math.floor(days))} days`;
  const doomed = "SELECT id FROM items WHERE cree_le < datetime('now', ?)";

  // Enfants d'abord (FK items.id ← verdicts/drafts), puis les items.
  await env.DB.prepare(`DELETE FROM drafts   WHERE item_id IN (${doomed})`).bind(modifier).run();
  await env.DB.prepare(`DELETE FROM verdicts WHERE item_id IN (${doomed})`).bind(modifier).run();
  const res = await env.DB.prepare("DELETE FROM items WHERE cree_le < datetime('now', ?)").bind(modifier).run();

  return { jours: Math.max(1, Math.floor(days)), items: res.meta.changes ?? 0 };
}
