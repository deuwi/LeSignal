import { Hono } from "hono";
import type { Env } from "./types";
import { runDaily } from "./daily";
import { ranWithin } from "./state";
import { loadConfig, saveConfig, type Config } from "./config";
import { requireAdmin } from "./auth";
import { createNotionPage } from "./notion/write";
import { runBackfillEn } from "./curate/backfill";
import { ingestItems } from "./ingest";
import { normalizeSignal, trendToRawItem, type TrendSignal } from "./ingest/trends";
import { writeTrendSignalsToSheet } from "./sheets/trends-sheet";

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
    `SELECT i.id, i.url, i.titre, i.resume, i.titre_fr, i.resume_fr, i.titre_en, i.resume_en,
            i.date_pub, i.flux, i.statut, i.raison_rejet,
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
  const unauth = await requireAdmin(c);
  if (unauth) return unauth;
  const body = await c.req.json<Config>();
  // validation + bornes anti-ReDoS/abus (les motifs sont compilés en regex)
  const MAX_ROWS = 60, MAX_PAT = 300, MAX_THESE = 3000;
  if (typeof body.freshness_days !== "number" || !Array.isArray(body.exclusions) || !Array.isArray(body.categories)) {
    return c.json({ ok: false, error: "config invalide" }, 400);
  }
  if (body.freshness_days < 1 || body.freshness_days > 365) {
    return c.json({ ok: false, error: "freshness_days hors bornes (1-365)" }, 400);
  }
  if (body.exclusions.length > MAX_ROWS || body.categories.length > MAX_ROWS) {
    return c.json({ ok: false, error: "trop de règles" }, 400);
  }
  if ((body.these_keywords ?? "").length > MAX_THESE) {
    return c.json({ ok: false, error: "these_keywords trop long" }, 400);
  }
  for (const e of body.exclusions) if ((e?.pattern ?? "").length > MAX_PAT) return c.json({ ok: false, error: "motif trop long" }, 400);
  for (const ct of body.categories) if ((ct?.keywords ?? "").length > MAX_PAT) return c.json({ ok: false, error: "motif trop long" }, 400);
  await saveConfig(c.env, body);
  return c.json({ ok: true });
});

// Réinitialise: supprime l'override → loadConfig renverra les défauts
app.delete("/api/config", async (c) => {
  const unauth = await requireAdmin(c);
  if (unauth) return unauth;
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

// Marquer lu / favori (flux dev, lecture perso) — écriture, protégée
app.post("/api/items/:id/flag", async (c) => {
  const unauth = await requireAdmin(c);
  if (unauth) return unauth;
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
    `SELECT d.item_id, d.fait, d.angle, d.fait_en, d.angle_en, d.sources_line, d.statut,
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
  const unauth = await requireAdmin(c);
  if (unauth) return unauth;
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

// Créer une fiche dans Notion — action d'ÉCRITURE, protégée par ADMIN_TOKEN.
app.post("/api/drafts/:id/notion", async (c) => {
  const unauth = await requireAdmin(c);
  if (unauth) return unauth;

  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare(
    `SELECT d.fait, d.angle, d.notion_id, i.url,
            v.chapitre, v.profil, v.chiffres_flag
     FROM drafts d JOIN items i ON i.id=d.item_id
     LEFT JOIN verdicts v ON v.item_id=d.item_id
     WHERE d.item_id=?`
  ).bind(id).first<{
    fait: string; angle: string; notion_id: string | null; url: string;
    chapitre: number | null; profil: string | null; chiffres_flag: string | null;
  }>();
  if (!row) return c.json({ error: "fiche introuvable" }, 404);
  if (row.notion_id) return c.json({ ok: true, notion_id: row.notion_id, already: true });

  try {
    const pageId = await createNotionPage(c.env, {
      fait: row.fait, angle: row.angle, chapitre: row.chapitre,
      profil: row.profil, chiffres_flag: row.chiffres_flag, url: row.url,
    });
    await c.env.DB.prepare("UPDATE drafts SET notion_id=?, statut='dans_notion' WHERE item_id=?")
      .bind(pageId, id).run();
    return c.json({ ok: true, notion_id: pageId });
  } catch (e) {
    console.error("notion create error:", e); // détail côté serveur uniquement
    return c.json({ error: "échec création Notion" }, 502);
  }
});

// One-shot : traduit en EN les fiches sans version anglaise. ?limit=<=40. Protégé.
app.post("/api/backfill-en", async (c) => {
  const unauth = await requireAdmin(c);
  if (unauth) return unauth;
  const limit = Math.min(Number(c.req.query("limit") ?? "40"), 40);
  const report = await runBackfillEn(c.env, limit);
  return c.json(report);
});

// Traduction des items de la sélection (flux dev) — action LLM, protégée.
// Découplée de la passe quotidienne (trop lourde en une invocation) : tourne sur
// son propre cron et à la demande ici. ?limit=<=80.
app.post("/api/translate", async (c) => {
  const unauth = await requireAdmin(c);
  if (unauth) return unauth;
  const { runTranslate } = await import("./curate/translate");
  // Plafond sous la limite de sous-requêtes par invocation Worker (~50).
  const limit = Math.min(Number(c.req.query("limit") ?? "45"), 45);
  const report = await runTranslate(c.env, limit);
  return c.json(report);
});

// Réception des signaux Google Trends poussés depuis l'extérieur (trend_watch.py
// tourne sur une IP résidentielle : l'API Trends est CAPTCHA-wallée sur IP
// datacenter). Admin-gated. Ingère dans le pipeline (source_id 26, flux deuwi)
// puis écrit les BREAKOUTS dans le Google Sheet « Signaux Trends » (à trier),
// fail-soft. Body: { "signals": [{seed,geo,query,value,breakout}], "date"?: "YYYY-MM-DD" }
const TRENDS_SOURCE_ID = 26;
app.post("/api/ingest-trends", async (c) => {
  const unauth = await requireAdmin(c);
  if (unauth) return unauth;
  const body = await c.req.json<{ signals?: unknown[]; date?: string }>().catch(() => ({} as { signals?: unknown[]; date?: string }));
  const signals = (body.signals ?? [])
    .map(normalizeSignal)
    .filter((s): s is TrendSignal => s !== null);
  if (!signals.length) return c.json({ received: 0, ingest: null, notion: [] });

  const nowIso = new Date().toISOString();
  const dateOnly = (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(body.date) ? body.date : nowIso).slice(0, 10);

  // 1) pipeline : tous les signaux (rising + breakout) → items dedup/pré-filtre.
  const items = signals.map((s) => trendToRawItem(s, nowIso));
  const ingest = await ingestItems(c.env, TRENDS_SOURCE_ID, "deuwi", items);

  // 2) Google Sheet « à trier » : breakouts seulement (les hausses simples restent
  //    dans l'app ; le breakout est le signal fort à trier à la main). Dédup avant
  //    append, fail-soft.
  const breakouts = signals.filter((s) => s.breakout);
  const sheet = await writeTrendSignalsToSheet(c.env, breakouts, dateOnly);
  const sheetErr = sheet.filter((r) => r.action === "error");
  if (sheetErr.length) console.error("ingest-trends sheet:", JSON.stringify(sheetErr));

  return c.json({ received: signals.length, ingest, sheet_breakouts: breakouts.length, sheet });
});

// Static assets (dashboard) en fallback
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  // Deux crons (voir wrangler.jsonc) : 07:00 = passe complète, 09:00 = traduction
  // des items (découplée car la passe complète sature déjà l'invocation).
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === "0 9 * * *") {
      ctx.waitUntil(
        import("./curate/translate").then(({ runTranslate }) =>
          runTranslate(env, 45).then((r) => console.log("translate:", JSON.stringify(r)))
        )
      );
    } else {
      ctx.waitUntil(runDaily(env).then((r) => console.log("daily:", JSON.stringify(r))));
    }
  },
};
