const view = document.getElementById("view");
const statusEl = document.getElementById("status");
let tab = "dev";
let cfg = null; // config cache (catégories, etc.)
let lang = localStorage.getItem("signal_lang") || "fr";
let theme = localStorage.getItem("signal_theme") || ((window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");

// filtres onglet Dev
const dev = { statut: "retenu", categorie: null, favori: false };

const CHAP = { 1: "IA sait faire", 2: "marché brutal", 3: "producteur→directeur", 4: "architecture", 5: "diriger l'IA", 6: "lire/auditer", 7: "sens produit", 8: "communiquer", 9: "apprendre", 10: "auto-diagnostic", 11: "plan 90j", 12: "portfolio/CV", 13: "par profil", 14: "antifragile" };
const CHIFFRES = { ok: "OK", a_verifier: "À vérifier", inconnu: "Inconnu" };
const PROFIL_LABEL = { junior: "junior", confirme: "confirmé", reconverti: "reconverti", freelance: "freelance" };

// ---------- i18n (chrome + copie éditoriale ; les titres d'items restent tels quels) ----------
const I18N = {
  fr: {
    kicker: "VEILLE DEV · PAR DEUWI",
    subtitle: "La veille dev. Le signal, pas le bruit.",
    edition: "ÉDITION",
    nav_dev: "La sélection", nav_deuwi: "Atelier Deuwi", nav_sources: "Sources", nav_reglages: "Réglages",
    method: "Une passe quotidienne, dédoublonnée.",
    about: "À propos",
    theme_dark: "Sombre", theme_light: "Clair",
    status_auto: "Mise à jour automatique quotidienne",
    standfirst: "L'IA ne prendra pas ton job. Quelqu'un qui la dirige mieux que toi, si. Sans hype, sans déni.",
    aside_label: "Le bruit qu'on a coupé",
    aside_text: "Ce que le pré-filtre écarte : « l'IA va remplacer les devs », les formations à six chiffres, la peur artificielle, la dernière sortie produit qui n'a rien à voir avec le code que tu écris, la politique.",
    read_more: "lire ↓", read_less: "replier ↑",
    f_retenu: "retenus", f_rejete: "écartés", f_all: "tout",
    chip_all: "Tout", chip_fav: "Favoris",
    empty_dev: "Aucune entrée pour ce filtre.",
    empty_deuwi: "Aucune proposition. La passe quotidienne alimente l'atelier et écarte ce qui est déjà sur Notion.",
    proposals: "propositions", draft_hint: "copie la ligne, colle dans Notion — ce qui y est déjà est écarté.",
    rej: "écarté",
    copy: "Copier pour Notion", copied: "Copié ✓", create_notion: "Créer dans Notion",
    src_label: "Sources", none_chap: "sans chapitre", no_figures: "sans chiffre", score: "score",
    reg_note: "Modifs appliquées à la prochaine passe. Les motifs sont des regex (insensibles à la casse).",
    reg_fresh: "Fraîcheur (jours)", reg_these: "Mots-clés thèse (flux Atelier) — regex",
    reg_excl: "Exclusions dures", reg_cat: "Catégories dev", reg_add: "ajouter",
    reg_save: "Enregistrer", reg_reset: "Réinitialiser", reg_saved: "enregistré ✓",
    th_nom: "Nom", th_type: "Type", th_flux: "Flux", th_rank: "Rang", th_actif: "Actif", th_last: "Dernière passe",
    yes: "oui", no: "non",
  },
  en: {
    kicker: "DEV WATCH · BY DEUWI",
    subtitle: "The dev watch. Signal, not noise.",
    edition: "EDITION",
    nav_dev: "The selection", nav_deuwi: "Deuwi Workshop", nav_sources: "Sources", nav_reglages: "Settings",
    method: "One daily pass, de-duplicated.",
    about: "About",
    theme_dark: "Dark", theme_light: "Light",
    status_auto: "Automatic daily update",
    standfirst: "AI won't take your job. Someone who directs it better than you will. No hype, no denial.",
    aside_label: "The noise we cut",
    aside_text: "What the pre-filter drops: “AI will replace developers”, six-figure bootcamps, artificial fear, the latest product launch that has nothing to do with the code you write, politics.",
    read_more: "read ↓", read_less: "collapse ↑",
    f_retenu: "kept", f_rejete: "dropped", f_all: "all",
    chip_all: "All", chip_fav: "Favourites",
    empty_dev: "No entry for this filter.",
    empty_deuwi: "No proposal. The daily pass feeds the workshop and drops what's already in Notion.",
    proposals: "proposals", draft_hint: "copy the row, paste into Notion — anything already there is dropped.",
    rej: "dropped",
    copy: "Copy for Notion", copied: "Copied ✓", create_notion: "Create in Notion",
    src_label: "Sources", none_chap: "no chapter", no_figures: "no figure", score: "score",
    reg_note: "Changes apply on the next pass. Patterns are regexes (case-insensitive).",
    reg_fresh: "Freshness (days)", reg_these: "Thesis keywords (Workshop flux) — regex",
    reg_excl: "Hard exclusions", reg_cat: "Dev categories", reg_add: "add",
    reg_save: "Save", reg_reset: "Reset", reg_saved: "saved ✓",
    th_nom: "Name", th_type: "Type", th_flux: "Flux", th_rank: "Rank", th_actif: "Active", th_last: "Last pass",
    yes: "yes", no: "no",
  },
};
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.fr[k] || k;
const locale = () => (lang === "fr" ? "fr-FR" : "en-GB");
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString(locale(), { day: "2-digit", month: "short", year: "numeric" }) : "—"; }

// ---------- helpers ----------
async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}
function setStatus(msg) { statusEl.textContent = msg; }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// Clé admin (protège toutes les écritures). Saisie 1×, gardée en localStorage.
function adminToken() {
  let x = localStorage.getItem("veille_admin");
  if (!x) { x = prompt("Clé admin (pour les actions d'écriture) :"); if (x) { x = x.trim(); localStorage.setItem("veille_admin", x); } }
  return x;
}
// Appel d'ÉCRITURE: injecte la clé admin, gère le 401.
async function writeApi(path, opts = {}) {
  const x = adminToken();
  if (!x) throw new Error("clé admin requise");
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), "x-admin-token": x } });
  if (res.status === 401) { localStorage.removeItem("veille_admin"); throw new Error("clé admin refusée"); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
  return res.json().catch(() => ({}));
}
function safeUrl(u) { return /^https?:\/\//i.test(String(u ?? "")) ? String(u) : "#"; }
async function ensureConfig() { if (!cfg) cfg = await api("/api/config"); return cfg; }
function parseJson(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } }

function refLinks(linksStr) {
  const links = parseJson(linksStr, []);
  if (!links.length) return "";
  const items = links.map(u => {
    let host = u; try { host = new URL(u).host.replace(/^www\./, ""); } catch {}
    return `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${esc(host)} ↗</a>`;
  }).join(" · ");
  return `<p class="refs">${items}</p>`;
}
function catSurtitle(catStr) {
  const cats = parseJson(catStr, []);
  return cats.length ? cats.join(" · ") : "";
}

// ---------- La sélection (flux dev) ----------
async function renderItems() {
  await ensureConfig();
  const chips = [
    `<button class="chip ${!dev.categorie && !dev.favori ? "active" : ""}" data-cat="">${esc(t("chip_all"))}</button>`,
    ...cfg.categories.map(c => `<button class="chip ${dev.categorie === c.name ? "active" : ""}" data-cat="${esc(c.name)}">${esc(c.name)}</button>`),
    `<button class="chip ${dev.favori ? "active" : ""}" data-fav="1">★ ${esc(t("chip_fav"))}</button>`,
  ].join("");
  const statusRow = [["retenu", "f_retenu"], ["rejete", "f_rejete"], ["all", "f_all"]].map(([v, k]) =>
    `<button data-st="${v}" class="${dev.statut === v ? "active" : ""}">${esc(t(k))}</button>`).join("");

  const qs = new URLSearchParams({ flux: "dev", statut: dev.statut, limit: "200" });
  if (dev.categorie) qs.set("categorie", dev.categorie);
  if (dev.favori) qs.set("favori", "1");
  const items = await api(`/api/items?${qs}`);

  const intro =
    `<p class="standfirst">${esc(t("standfirst"))}</p>` +
    `<div class="aside"><span class="label">${esc(t("aside_label"))}</span><p>${esc(t("aside_text"))}</p></div>`;
  const head = `<div class="chips">${chips}</div><div class="filters">${statusRow}</div>`;

  if (!items.length) { view.innerHTML = intro + head + `<div class="empty">${esc(t("empty_dev"))}</div>`; wireDev(); return; }

  view.innerHTML = intro + head + items.map(it => {
    const cat = catSurtitle(it.categories);
    const rejected = it.statut === "rejete";
    const titre = (lang === "en" ? it.titre_en : it.titre_fr) || it.titre;
    const resume = (lang === "en" ? it.resume_en : it.resume_fr) ?? it.resume;
    return `
    <article class="entry ${rejected ? "entry--rejete" : ""}">
      <div class="entry-side">
        <time>${esc(fmtDate(it.date_pub))}</time>
        <span class="src">${esc(it.source)}</span>
        <button class="fav ${it.favori ? "on" : ""}" data-id="${it.id}" aria-label="favori">★</button>
        ${rejected ? `<span class="rej">${esc(t("rej"))}${it.raison_rejet ? " · " + esc(it.raison_rejet) : ""}</span>` : ""}
      </div>
      <div class="entry-main">
        ${cat ? `<div class="kicker-cat">${esc(cat)}</div>` : ""}
        <h3><a href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener">${esc(titre)}</a></h3>
        ${resume ? (resume.length > 180
          ? `<p class="sum clamp">${esc(resume)}</p><button type="button" class="more">${esc(t("read_more"))}</button>`
          : `<p class="sum">${esc(resume)}</p>`) : ""}
        ${refLinks(it.links)}
      </div>
    </article>`;
  }).join("");
  wireDev();
  view.querySelectorAll(".more").forEach(b => b.onclick = () => {
    const sum = b.previousElementSibling;
    const collapsed = sum.classList.toggle("clamp"); // true = replié
    b.textContent = collapsed ? t("read_more") : t("read_less");
  });
  view.querySelectorAll(".fav").forEach(b => b.onclick = async () => {
    const on = !b.classList.contains("on");
    try {
      await writeApi(`/api/items/${b.dataset.id}/flag`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ favori: on }) });
      b.classList.toggle("on", on);
    } catch (e) { setStatus("favori: " + e.message); }
  });
}
function wireDev() {
  view.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { dev.categorie = b.dataset.cat || null; dev.favori = false; renderItems(); });
  view.querySelectorAll("[data-fav]").forEach(b => b.onclick = () => { dev.favori = true; dev.categorie = null; renderItems(); });
  view.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { dev.statut = b.dataset.st; renderItems(); });
}

// ---------- Atelier Deuwi (drafts, lecture seule + copier) ----------
// Cellules dans l'ordre des colonnes Notion: Fait | Angle | Chapitre | Profil | Chiffres | Source
function copyCells(d) {
  return [
    d.fait || "",
    d.angle || "",
    d.chapitre ? String(d.chapitre) : "aucun",
    PROFIL_LABEL[d.profil] || d.profil || "",
    CHIFFRES[d.chiffres_flag] || "",
    d.url || "",
  ];
}
function csvField(v) { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
async function copyRow(d) { await navigator.clipboard.writeText(copyCells(d).map(csvField).join(",")); }

async function renderDrafts() {
  const drafts = await api(`/api/drafts?statut=propose`);
  if (!drafts.length) { view.innerHTML = `<div class="empty">${esc(t("empty_deuwi"))}</div>`; return; }

  view.innerHTML = `<p class="hint">${drafts.length} ${esc(t("proposals"))} · ${esc(t("draft_hint"))}</p>` +
    drafts.map(d => {
      const chap = d.chapitre ? `CH. ${d.chapitre} — ${esc(CHAP[d.chapitre] || "")}` : esc(t("none_chap"));
      const flag = d.chiffres_flag ? `${esc(CHIFFRES[d.chiffres_flag] || "?")}` : esc(t("no_figures"));
      const dfait = (lang === "en" && d.fait_en) ? d.fait_en : d.fait;
      const dangle = (lang === "en" && d.angle_en) ? d.angle_en : d.angle;
      return `
    <article class="entry draft" data-id="${d.item_id}">
      <div class="badges">
        <span class="badge">${chap}</span>
        ${d.profil ? `<span class="badge profil">${esc(PROFIL_LABEL[d.profil] || d.profil)}</span>` : ""}
        <span class="badge flag-${d.chiffres_flag || "inconnu"}">${flag}</span>
        <span class="right">${esc(d.source)} · ${esc(fmtDate(d.date_pub))} · ${t("score")} ${d.score != null ? d.score.toFixed(2) : "—"}</span>
      </div>
      <p class="fait">${esc(dfait)}</p>
      <div class="angle"><span class="label">Angle</span>${esc(dangle)}</div>
      <p class="src">${esc(t("src_label"))} : <a href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener">${esc((d.sources_line || d.url).replace(/^\s*sources?\s*:\s*/i, ""))}</a></p>
      ${refLinks(d.links)}
      <div class="draft-actions">
        <button class="copy">${esc(t("copy"))}</button>
        <button class="notion">${esc(t("create_notion"))}</button>
      </div>
    </article>`;
    }).join("");

  view.querySelectorAll(".entry.draft").forEach((card, i) => {
    card.querySelector(".copy").onclick = async () => {
      try {
        await copyRow(drafts[i]);
        card.classList.add("copied");
        const b = card.querySelector(".copy");
        b.classList.add("copied"); b.textContent = t("copied");
        setStatus(t("copied"));
      } catch (e) { setStatus("copie impossible: " + e.message); }
    };
    card.querySelector(".notion").onclick = async () => {
      const x = adminToken();
      if (!x) return;
      const btn = card.querySelector(".notion");
      btn.disabled = true; setStatus("Notion…");
      try {
        const res = await fetch(`/api/drafts/${drafts[i].item_id}/notion`, { method: "POST", headers: { "x-admin-token": x } });
        if (res.status === 401) { localStorage.removeItem("veille_admin"); setStatus("clé refusée"); alert("Clé admin refusée. Réessaie."); btn.disabled = false; return; }
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
        setStatus("Notion ✓"); renderDrafts();
      } catch (e) { setStatus("Notion: " + e.message); alert("Notion: " + e.message); btn.disabled = false; }
    };
  });
}

// ---------- Sources ----------
async function renderSources() {
  const src = await api("/api/sources");
  view.innerHTML = `<table>
    <tr><th>${esc(t("th_nom"))}</th><th>${esc(t("th_type"))}</th><th>${esc(t("th_flux"))}</th><th>${esc(t("th_rank"))}</th><th>${esc(t("th_actif"))}</th><th>${esc(t("th_last"))}</th></tr>
    ${src.map(s => `<tr class="${s.actif ? "" : "off"}">
      <td>${esc(s.nom)}</td><td>${esc(s.type)}</td><td>${esc(s.flux)}</td><td>${s.rank}</td>
      <td>${s.actif ? esc(t("yes")) : esc(t("no"))}</td><td>${s.last_run ? new Date(s.last_run).toLocaleString(locale()) : "—"}</td>
    </tr>`).join("")}
  </table>`;
}

// ---------- Réglages ----------
async function renderReglages() {
  const c = await api("/api/config");
  cfg = c;
  const rows = (arr, ka, kb, la, lb) => arr.map((o, i) => `
    <div class="cfg-row">
      <input data-i="${i}" data-k="${ka}" value="${esc(o[ka])}" placeholder="${la}" />
      <input data-i="${i}" data-k="${kb}" value="${esc(o[kb])}" placeholder="${lb}" class="wide" />
      <button class="del" data-del="${i}">✕</button>
    </div>`).join("");

  view.innerHTML = `
    <div class="reglages">
      <p class="hint">${esc(t("reg_note"))}</p>
      <label>${esc(t("reg_fresh"))}</label>
      <input id="freshness" type="number" min="1" value="${c.freshness_days}" />
      <label>${esc(t("reg_these"))}</label>
      <textarea id="these" rows="3">${esc(c.these_keywords)}</textarea>
      <h3>${esc(t("reg_excl"))} <button id="add-excl" class="add">+ ${esc(t("reg_add"))}</button></h3>
      <div id="exclusions">${rows(c.exclusions, "tag", "pattern", "tag", "regex")}</div>
      <h3>${esc(t("reg_cat"))} <button id="add-cat" class="add">+ ${esc(t("reg_add"))}</button></h3>
      <div id="categories">${rows(c.categories, "name", "keywords", "nom", "regex")}</div>
      <div class="save-bar">
        <button id="save-cfg">${esc(t("reg_save"))}</button>
        <button id="reset-cfg" class="ghost">${esc(t("reg_reset"))}</button>
        <span id="cfg-status"></span>
      </div>
    </div>`;

  const collect = (sel, ka, kb) => [...view.querySelectorAll(`#${sel} .cfg-row`)].map(row => ({
    [ka]: row.querySelector(`[data-k="${ka}"]`).value.trim(),
    [kb]: row.querySelector(`[data-k="${kb}"]`).value.trim(),
  })).filter(o => o[ka] || o[kb]);

  view.querySelector("#add-excl").onclick = () => { c.exclusions.push({ tag: "", pattern: "" }); renderReglages(); };
  view.querySelector("#add-cat").onclick = () => { c.categories.push({ name: "", keywords: "" }); renderReglages(); };
  view.querySelectorAll("#exclusions .del").forEach(b => b.onclick = () => { c.exclusions.splice(+b.dataset.del, 1); renderReglages(); });
  view.querySelectorAll("#categories .del").forEach(b => b.onclick = () => { c.categories.splice(+b.dataset.del, 1); renderReglages(); });

  view.querySelector("#save-cfg").onclick = async () => {
    const body = {
      freshness_days: Number(view.querySelector("#freshness").value) || 7,
      these_keywords: view.querySelector("#these").value.trim(),
      exclusions: collect("exclusions", "tag", "pattern"),
      categories: collect("categories", "name", "keywords"),
    };
    try {
      await writeApi("/api/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      cfg = body;
      view.querySelector("#cfg-status").textContent = t("reg_saved");
    } catch (e) { view.querySelector("#cfg-status").textContent = "erreur: " + e.message; }
  };
  view.querySelector("#reset-cfg").onclick = async () => {
    if (!confirm(t("reg_reset") + " ?")) return;
    try { await writeApi("/api/config", { method: "DELETE" }); cfg = null; location.reload(); }
    catch (e) { view.querySelector("#cfg-status").textContent = "erreur: " + e.message; }
  };
}

// ---------- routage + langue ----------
async function render() {
  try {
    if (tab === "sources") await renderSources();
    else if (tab === "deuwi") await renderDrafts();
    else if (tab === "reglages") await renderReglages();
    else await renderItems();
  } catch (e) { view.innerHTML = `<div class="empty">Erreur: ${esc(e.message)}</div>`; }
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById("theme-btn");
  if (btn) btn.textContent = theme === "light" ? t("theme_dark") : t("theme_light");
}

function applyLang() {
  document.documentElement.lang = lang;
  document.getElementById("t-kicker").textContent = t("kicker");
  document.getElementById("t-subtitle").textContent = t("subtitle");
  const now = new Date();
  document.getElementById("t-edition").textContent =
    t("edition") + " · " + now.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  document.getElementById("t-method").textContent = t("method");
  document.querySelectorAll("[data-i18n]").forEach(b => b.textContent = t(b.dataset.i18n));
  document.querySelectorAll("#lang [data-lang]").forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
  applyTheme(); // rafraîchit le libellé du bouton thème dans la langue
  setStatus(t("status_auto"));
}

document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("active", x === b));
  render();
});
document.querySelectorAll("#lang [data-lang]").forEach(b => b.onclick = () => {
  lang = b.dataset.lang; localStorage.setItem("signal_lang", lang);
  applyLang(); render();
});
document.getElementById("theme-btn").onclick = () => {
  theme = theme === "light" ? "dark" : "light";
  localStorage.setItem("signal_theme", theme);
  applyTheme();
};

applyTheme();
applyLang();
render();
