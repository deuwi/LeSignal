import { Hono } from "hono";
import type { Env } from "./types";
import { runDaily } from "./daily";
import { ranWithin } from "./state";
import { loadConfig, saveConfig, type Config } from "./config";

const app = new Hono<{ Bindings: Env }>();

// --- API (lecture) ---

// Liste items. ?flux=dev|deuwi  ?statut=retenu|rejete|all  ?categorie=<nom>  ?favori=1  ?limit=
app.get("/api/items", async (c) => {
  const flux = c.req.query("flux");
  const statut = c.req.query("statut");
  const categorie = c.req.query("categorie");
  const favori = c.req.query("favori");
  const limit = Math.min(Number(c.req.query("limit") ?? "100"), 500);

  const where: string[] = [];
  const binds: unknown[] = [];
  if (flux === "dev") { where.push("(i.flux='dev' OR i.flux='both')"); }
  else if (flux === "deuwi") { where.push("(i.flux='deuwi' OR i.flux='both')"); }
  if (statut && statut !== "all") { where.push("i.statut=?"); binds.push(statut); }
  if (categorie) { where.push("i.categories LIKE ?"); binds.push(`%"${categorie}"%`); }
  if (favori === "1") { where.push("i.favori=1"); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.url, i.titre, i.resume, i.date_pub, i.flux, i.statut, i.raison_rejet,
            i.lu, i.favori, i.categories, i.links, s.nom AS source, s.rank
     FROM items i JOIN sources s ON s.id=i.source_id
     ${clause}
     ORDER BY s.rank DESC, i.date_pub DESC
     LIMIT ?`
  ).bind(...binds, limit).all();
  return c.json(results);
});

// Config éditable (Réglages)
app.get("/api/config", async (c) => c.json(await loadConfig(c.env)));

app.put("/api/config", async (c) => {
  const body = await c.req.json<Config>();
  // validation minimale
  if (typeof body.freshness_days !== "number" || !Array.isArray(body.exclusions) || !Array.isArray(body.categories)) {
    return c.json({ ok: false, error: "config invalide" }, 400);
  }
  await saveConfig(c.env, body);
  return c.json({ ok: true });
});

// Réinitialise: supprime l'override → loadConfig renverra les défauts
app.delete("/api/config", async (c) => {
  await c.env.DB.prepare("DELETE FROM app_state WHERE key='config'").run();
  return c.json({ ok: true });
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

// Marquer lu / favori (flux dev, lecture perso)
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

// Fiches Deuwi proposées (non encore sur Notion). ?statut=propose (défaut) | dans_notion
app.get("/api/drafts", async (c) => {
  const statut = c.req.query("statut") ?? "propose";
  const { results } = await c.env.DB.prepare(
    `SELECT d.item_id, d.fait, d.angle, d.sources_line, d.statut,
            i.url, i.titre, i.date_pub, i.links,
            v.chapitre, v.profil, v.chiffres_flag, v.score, s.nom AS source
     FROM drafts d
     JOIN items i ON i.id=d.item_id
     LEFT JOIN verdicts v ON v.item_id=d.item_id
     JOIN sources s ON s.id=i.source_id
     WHERE d.statut=?
     ORDER BY v.score DESC, i.date_pub DESC`
  ).bind(statut).all();
  return c.json(results);
});

// Passe quotidienne — bornée à 1x/20h (anti-spam). ?force=1 pour bypasser en dev.
// Fire-and-forget: la passe est longue (ingest + Haiku), on répond tout de suite
// et le travail continue en tâche de fond (waitUntil), ce qui évite les coupures
// client et garantit le stamp de fin de garde-fou.
app.post("/api/daily", async (c) => {
  const force = c.req.query("force") === "1";
  if (!force && (await ranWithin(c.env, "daily", 20))) {
    return c.json({ skipped: true, reason: "passe déjà exécutée il y a moins de 20h" });
  }
  c.executionCtx.waitUntil(
    runDaily(c.env)
      .then((r) => console.log("daily (manuel):", JSON.stringify(r)))
      .catch((e) => console.error("daily error:", e))
  );
  return c.json({ started: true });
});

// Static assets (dashboard) en fallback
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  // Cron quotidien — voir wrangler.jsonc triggers
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDaily(env).then((r) => console.log("daily:", JSON.stringify(r))));
  },
};
