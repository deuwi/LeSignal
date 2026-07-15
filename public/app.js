const view = document.getElementById("view");
const statusEl = document.getElementById("status");
let tab = "dev";
let cfg = null; // config cache (catégories, etc.)

// filtres onglet Dev
const dev = { statut: "retenu", categorie: null, favori: false };

const CHAP = { 1: "IA sait faire", 2: "marché brutal", 3: "producteur→directeur", 4: "architecture", 5: "diriger l'IA", 6: "lire/auditer", 7: "sens produit", 8: "communiquer", 9: "apprendre", 10: "auto-diagnostic", 11: "plan 90j", 12: "portfolio/CV", 13: "par profil", 14: "antifragile" };
const CHIFFRES = { ok: "OK", a_verifier: "À vérifier", inconnu: "Inconnu" };

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}
function setStatus(msg) { statusEl.textContent = msg; }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

async function ensureConfig() { if (!cfg) cfg = await api("/api/config"); return cfg; }

function parseJson(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } }

// liens de référence → HTML
function refLinks(linksStr) {
  const links = parseJson(linksStr, []);
  if (!links.length) return "";
  const items = links.map(u => {
    let host = u; try { host = new URL(u).host.replace(/^www\./, ""); } catch {}
    return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host)}</a>`;
  }).join(" · ");
  return `<p class="refs">🔗 ${items}</p>`;
}
function catTags(catStr) {
  const cats = parseJson(catStr, []);
  return cats.map(c => `<span class="badge cat">${esc(c)}</span>`).join("");
}

// --- onglet Dev ---
async function renderItems() {
  await ensureConfig();
  const chips = [
    `<button class="chip ${!dev.categorie && !dev.favori ? "active" : ""}" data-cat="">Tout</button>`,
    ...cfg.categories.map(c => `<button class="chip ${dev.categorie === c.name ? "active" : ""}" data-cat="${esc(c.name)}">${esc(c.name)}</button>`),
    `<button class="chip ${dev.favori ? "active" : ""}" data-fav="1">★ Favoris</button>`,
  ].join("");
  const statusRow = ["retenu", "rejete", "all"].map(f =>
    `<button data-st="${f}" class="${dev.statut === f ? "active" : ""}">${f}</button>`).join("");

  const qs = new URLSearchParams({ flux: "dev", statut: dev.statut, limit: "200" });
  if (dev.categorie) qs.set("categorie", dev.categorie);
  if (dev.favori) qs.set("favori", "1");
  const items = await api(`/api/items?${qs}`);

  const head = `<div class="chips">${chips}</div><div class="filters">${statusRow}</div>`;
  if (!items.length) { view.innerHTML = head + `<div class="empty">Aucun item pour ce filtre.</div>`; wireDev(); return; }

  view.innerHTML = head + items.map(it => `
    <div class="card">
      <h3><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.titre)}</a></h3>
      ${it.resume ? `<p>${esc(it.resume).slice(0, 240)}</p>` : ""}
      ${refLinks(it.links)}
      <div class="meta">
        <span class="badge rank${it.rank}">${esc(it.source)}</span>
        ${catTags(it.categories)}
        <span>${it.date_pub ? new Date(it.date_pub).toLocaleDateString("fr-FR") : "?"}</span>
        <span class="badge ${it.statut}">${it.statut}${it.raison_rejet ? ": " + esc(it.raison_rejet) : ""}</span>
        <button class="fav ${it.favori ? "on" : ""}" data-id="${it.id}">★</button>
      </div>
    </div>`).join("");
  wireDev();
  view.querySelectorAll(".fav").forEach(b => b.onclick = async () => {
    const on = !b.classList.contains("on");
    await api(`/api/items/${b.dataset.id}/flag`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ favori: on }) });
    b.classList.toggle("on", on);
  });
}
function wireDev() {
  view.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { dev.categorie = b.dataset.cat || null; dev.favori = false; renderItems(); });
  view.querySelectorAll("[data-fav]").forEach(b => b.onclick = () => { dev.favori = true; dev.categorie = null; renderItems(); });
  view.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { dev.statut = b.dataset.st; renderItems(); });
}

// --- onglet Deuwi (lecture seule + copier) ---
function copyText(d) {
  const chap = d.chapitre ? `${d.chapitre} — ${CHAP[d.chapitre] || ""}`.trim() : "aucun";
  const refs = parseJson(d.links, []);
  return [
    `Fait : ${d.fait}`,
    `Angle : ${d.angle}`,
    `Chapitre : ${chap}`,
    `Profil : ${d.profil || "—"}`,
    `Chiffres : ${CHIFFRES[d.chiffres_flag] || "—"}`,
    `Source : ${d.url}`,
    refs.length ? `Références : ${refs.join(" , ")}` : "",
  ].filter(Boolean).join("\n");
}

async function renderDrafts() {
  const drafts = await api(`/api/drafts?statut=propose`);
  if (!drafts.length) {
    view.innerHTML = `<div class="empty">Aucune proposition. La passe quotidienne (cron) alimente les fiches et exclut celles déjà sur Notion.</div>`;
    return;
  }
  view.innerHTML = `<p class="hint">${drafts.length} proposition${drafts.length > 1 ? "s" : ""} — copie et colle dans Notion. Ce qui est déjà sur Notion est exclu automatiquement.</p>` +
    drafts.map(d => `
    <div class="card draft" data-id="${d.item_id}">
      <div class="meta">
        ${d.chapitre ? `<span class="badge">ch.${d.chapitre} ${esc(CHAP[d.chapitre] || "")}</span>` : `<span class="badge">aucun ch.</span>`}
        ${d.profil ? `<span class="badge accent">${esc(d.profil)}</span>` : ""}
        <span class="badge flag-${d.chiffres_flag}">chiffres: ${esc(CHIFFRES[d.chiffres_flag] || "?")}</span>
        <span class="badge rank3">${esc(d.source)}</span>
        <span>${d.date_pub ? new Date(d.date_pub).toLocaleDateString("fr-FR") : "?"}</span>
        <span>score ${d.score != null ? d.score.toFixed(2) : "?"}</span>
      </div>
      <p class="fait">${esc(d.fait)}</p>
      <p class="angle"><strong>Angle :</strong> ${esc(d.angle)}</p>
      <p class="src"><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.sources_line || d.url)}</a></p>
      ${refLinks(d.links)}
      <div class="draft-actions">
        <button class="copy">📋 Copier</button>
      </div>
    </div>`).join("");
  view.querySelectorAll(".card.draft").forEach((card, i) => {
    card.querySelector(".copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(copyText(drafts[i]));
        card.classList.add("copied");
        card.querySelector(".copy").textContent = "✓ Copié";
        setStatus("copié dans le presse-papier");
      } catch (e) { setStatus("copie impossible: " + e.message); }
    };
  });
}

// --- onglet Sources ---
async function renderSources() {
  const src = await api("/api/sources");
  view.innerHTML = `<table>
    <tr><th>Nom</th><th>Type</th><th>Flux</th><th>Rank</th><th>Actif</th><th>Dernière passe</th></tr>
    ${src.map(s => `<tr class="${s.actif ? "" : "off"}">
      <td>${esc(s.nom)}</td><td>${s.type}</td><td>${s.flux}</td><td>${s.rank}</td>
      <td>${s.actif ? "oui" : "non"}</td><td>${s.last_run ? new Date(s.last_run).toLocaleString("fr-FR") : "—"}</td>
    </tr>`).join("")}
  </table>`;
}

// --- onglet Réglages (config éditable) ---
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
      <p class="hint">Modifs appliquées à la prochaine passe quotidienne. Les motifs sont des regex (insensibles à la casse).</p>

      <label>Fraîcheur (jours)</label>
      <input id="freshness" type="number" min="1" value="${c.freshness_days}" />

      <label>Mots-clés thèse (flux Deuwi) — regex</label>
      <textarea id="these" rows="3">${esc(c.these_keywords)}</textarea>

      <h3>Exclusions dures <button id="add-excl" class="add">+ ajouter</button></h3>
      <div id="exclusions">${rows(c.exclusions, "tag", "pattern", "tag", "motif regex")}</div>

      <h3>Catégories dev <button id="add-cat" class="add">+ ajouter</button></h3>
      <div id="categories">${rows(c.categories, "name", "keywords", "nom", "mots-clés regex")}</div>

      <div class="save-bar">
        <button id="save-cfg">💾 Enregistrer</button>
        <button id="reset-cfg" class="ghost">Réinitialiser</button>
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
      await api("/api/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      cfg = body;
      view.querySelector("#cfg-status").textContent = "enregistré ✓";
    } catch (e) { view.querySelector("#cfg-status").textContent = "erreur: " + e.message; }
  };
  view.querySelector("#reset-cfg").onclick = async () => {
    if (!confirm("Réinitialiser la config aux valeurs par défaut ?")) return;
    await api("/api/config", { method: "DELETE" }).catch(() => {});
    cfg = null;
    location.reload();
  };
}

async function render() {
  try {
    if (tab === "sources") await renderSources();
    else if (tab === "deuwi") await renderDrafts();
    else if (tab === "reglages") await renderReglages();
    else await renderItems();
  } catch (e) { view.innerHTML = `<div class="empty">Erreur: ${esc(e.message)}</div>`; }
}

document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("active", x === b));
  render();
});

render();
