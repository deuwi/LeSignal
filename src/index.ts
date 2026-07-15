import { Hono } from "hono";
import type { Env } from "./types";
import { runIngest } from "./ingest";
import { runCurate } from "./curate";
import { runNotionSync } from "./notion/sync";

const app = new Hono<{ Bindings: Env }>();

// --- API ---

// Liste items. ?flux=dev|deuwi  ?statut=retenu|rejete|brut  ?limit=
app.get("/api/items", async (c) => {
  const flux = c.req.query("flux");
  const statut = c.req.query("statut");
  const limit = Math.min(Number(c.req.query("limit") ?? "100"), 500);

  const where: string[] = [];
  const binds: unknown[] = [];
  if (flux === "dev") { where.push("(i.flux='dev' OR i.flux='both')"); }
  else if (flux === "deuwi") { where.push("(i.flux='deuwi' OR i.flux='both')"); }
  if (statut) { where.push("i.statut=?"); binds.push(statut); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.url, i.titre, i.resume, i.date_pub, i.flux, i.statut, i.raison_rejet,
            i.lu, i.favori, s.nom AS source, s.rank
     FROM items i JOIN sources s ON s.id=i.source_id
     ${clause}
     ORDER BY s.rank DESC, i.date_pub DESC
     LIMIT ?`
  ).bind(...binds, limit).all();
  return c.json(results);
});

// Compteurs pour le dashboard
app.get("/api/stats", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT flux, statut, COUNT(*) AS n FROM items GROUP BY flux, statut`
  ).all();
  return c.json(results);
});

// Sources
app.get("/api/sources", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, type, nom, url, flux, rank, actif, last_run FROM sources ORDER BY flux, rank DESC"
  ).all();
  return c.json(results);
});

// Marquer lu / favori
app.post("/api/items/:id/flag", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ lu?: boolean; favori?: boolean }>();
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (body.lu !== undefined) { sets.push("lu=?"); binds.push(body.lu ? 1 : 0); }
  if (body.favori !== undefined) { sets.push("favori=?"); binds.push(body.favori ? 1 : 0); }
  if (!sets.length) return c.json({ ok: false, error: "rien à changer" }, 400);
  await c.env.DB.prepare(`UPDATE items SET ${sets.join(",")} WHERE id=?`).bind(...binds, id).run();
  return c.json({ ok: true });
});

// Déclenchement manuel de la passe. ?source=<id> pour une seule source.
app.post("/api/run", async (c) => {
  const only = c.req.query("source");
  const report = await runIngest(c.env, only ? Number(only) : undefined);
  return c.json(report);
});

// --- Curation Deuwi (Phase 2) ---

// Lance étages 3-4 (Haiku) sur les items retenus non encore curés. ?limit=
app.post("/api/curate", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? "15"), 40);
  const report = await runCurate(c.env, limit);
  return c.json(report);
});

// Fiches (drafts) pour le kanban Deuwi. ?statut=brouillon|valide|jete
app.get("/api/drafts", async (c) => {
  const statut = c.req.query("statut");
  const where = statut ? "WHERE d.statut=?" : "";
  const binds = statut ? [statut] : [];
  const { results } = await c.env.DB.prepare(
    `SELECT d.item_id, d.fait, d.angle, d.sources_line, d.statut, d.notion_id,
            i.url, i.titre, i.date_pub,
            v.chapitre, v.profil, v.chiffres_flag, v.score, s.nom AS source
     FROM drafts d
     JOIN items i ON i.id=d.item_id
     LEFT JOIN verdicts v ON v.item_id=d.item_id
     JOIN sources s ON s.id=i.source_id
     ${where}
     ORDER BY v.score DESC, i.date_pub DESC`
  ).bind(...binds).all();
  return c.json(results);
});

// Éditer une fiche (angle/fait réécrits à la main — semi-assisté)
app.patch("/api/drafts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const b = await c.req.json<{ fait?: string; angle?: string; sources_line?: string }>();
  const sets: string[] = [];
  const binds: unknown[] = [];
  for (const k of ["fait", "angle", "sources_line"] as const) {
    if (b[k] !== undefined) { sets.push(`${k}=?`); binds.push(b[k]); }
  }
  if (!sets.length) return c.json({ ok: false }, 400);
  sets.push("edite_le=datetime('now')");
  await c.env.DB.prepare(`UPDATE drafts SET ${sets.join(",")} WHERE item_id=?`).bind(...binds, id).run();
  return c.json({ ok: true });
});

// Valider / jeter une fiche
app.post("/api/drafts/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  const { statut } = await c.req.json<{ statut: "brouillon" | "valide" | "jete" }>();
  if (!["brouillon", "valide", "jete"].includes(statut)) return c.json({ ok: false }, 400);
  await c.env.DB.prepare("UPDATE drafts SET statut=?, edite_le=datetime('now') WHERE item_id=?").bind(statut, id).run();
  return c.json({ ok: true });
});

// Sync Notion des fiches validées. ?item=<id> pour une seule.
app.post("/api/notion/sync", async (c) => {
  const item = c.req.query("item");
  const report = await runNotionSync(c.env, item ? Number(item) : undefined);
  return c.json(report);
});

// Static assets (dashboard) en fallback
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  // Cron hebdo — voir wrangler.jsonc triggers
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runIngest(env).then((r) => console.log("ingest hebdo:", JSON.stringify(r))));
  },
};
