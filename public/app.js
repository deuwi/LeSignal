const view = document.getElementById("view");
const statusEl = document.getElementById("status");
let tab = "dev";
let itemFilter = "retenu"; // retenu | rejete | all
let draftFilter = "brouillon"; // brouillon | valide | jete
const CHAP = { 1: "IA sait faire", 2: "marché brutal", 3: "producteur→directeur", 4: "architecture", 5: "diriger l'IA", 6: "lire/auditer", 7: "sens produit", 8: "communiquer", 9: "apprendre", 10: "auto-diagnostic", 11: "plan 90j", 12: "portfolio/CV", 13: "par profil", 14: "antifragile" };

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function setStatus(msg) { statusEl.textContent = msg; }

// --- rendu items (dev / deuwi) ---
async function renderItems(flux) {
  const statutQ = itemFilter === "all" ? "" : `&statut=${itemFilter}`;
  const items = await api(`/api/items?flux=${flux}${statutQ}&limit=200`);
  const filters = `
    <div class="filters">
      ${["retenu", "rejete", "all"].map(f =>
        `<button data-filter="${f}" class="${itemFilter === f ? "active" : ""}">${f}</button>`).join("")}
    </div>`;
  if (!items.length) { view.innerHTML = filters + `<div class="empty">Aucun item. Lance une passe ↻ Run.</div>`; wireFilters(flux); return; }

  view.innerHTML = filters + items.map(it => `
    <div class="card">
      <h3><a href="${it.url}" target="_blank" rel="noopener">${esc(it.titre)}</a></h3>
      ${it.resume ? `<p>${esc(it.resume).slice(0, 240)}</p>` : ""}
      <div class="meta">
        <span class="badge rank${it.rank}">${esc(it.source)}</span>
        <span>${it.date_pub ? new Date(it.date_pub).toLocaleDateString("fr-FR") : "?"}</span>
        <span class="badge ${it.statut}">${it.statut}${it.raison_rejet ? ": " + esc(it.raison_rejet) : ""}</span>
        <button class="fav ${it.favori ? "on" : ""}" data-id="${it.id}">★</button>
      </div>
    </div>`).join("");
  wireFilters(flux);
  view.querySelectorAll(".fav").forEach(b => b.onclick = async () => {
    const on = !b.classList.contains("on");
    await api(`/api/items/${b.dataset.id}/flag`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ favori: on }) });
    b.classList.toggle("on", on);
  });
}

function wireFilters(flux) {
  view.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { itemFilter = b.dataset.filter; renderItems(flux); });
}

// --- rendu fiches Deuwi (kanban) ---
async function renderDrafts() {
  const drafts = await api(`/api/drafts?statut=${draftFilter}`);
  const filters = `
    <div class="filters">
      ${["brouillon", "valide", "jete"].map(f =>
        `<button data-dfilter="${f}" class="${draftFilter === f ? "active" : ""}">${f}</button>`).join("")}
    </div>`;
  if (!drafts.length) {
    view.innerHTML = filters + `<div class="empty">Aucune fiche « ${draftFilter} ». Ingère (↻ Run) puis cure (⚗ Curer).</div>`;
    wireDraftFilters(); return;
  }
  view.innerHTML = filters + drafts.map(d => `
    <div class="card draft" data-id="${d.item_id}">
      <div class="meta">
        ${d.chapitre ? `<span class="badge">ch.${d.chapitre} ${esc(CHAP[d.chapitre] || "")}</span>` : `<span class="badge">aucun ch.</span>`}
        ${d.profil ? `<span class="badge accent">${esc(d.profil)}</span>` : ""}
        <span class="badge flag-${d.chiffres_flag}">chiffres: ${esc(d.chiffres_flag || "?")}</span>
        <span class="badge rank3">${esc(d.source)}</span>
        <span>${d.date_pub ? new Date(d.date_pub).toLocaleDateString("fr-FR") : "?"}</span>
        <span>score ${d.score != null ? d.score.toFixed(2) : "?"}</span>
      </div>
      <p class="fait" contenteditable data-field="fait">${esc(d.fait)}</p>
      <p class="angle" contenteditable data-field="angle"><strong>Angle:</strong> ${esc(d.angle)}</p>
      <p class="src"><a href="${d.url}" target="_blank" rel="noopener">${esc(d.sources_line || d.url)}</a></p>
      <div class="draft-actions">
        <button class="save">💾 Enregistrer</button>
        ${d.statut !== "valide" ? `<button class="ok" data-s="valide">✓ Valider</button>` : ""}
        ${d.statut !== "jete" ? `<button class="no" data-s="jete">✕ Jeter</button>` : ""}
        ${d.statut !== "brouillon" ? `<button class="back" data-s="brouillon">↩ Brouillon</button>` : ""}
      </div>
    </div>`).join("");
  wireDraftFilters();
  view.querySelectorAll(".card.draft").forEach(card => {
    const id = card.dataset.id;
    card.querySelector(".save").onclick = async () => {
      const fait = card.querySelector('[data-field="fait"]').textContent.trim();
      const angleEl = card.querySelector('[data-field="angle"]');
      const angle = angleEl.textContent.replace(/^Angle:\s*/, "").trim();
      await api(`/api/drafts/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fait, angle }) });
      setStatus("fiche enregistrée");
    };
    card.querySelectorAll("[data-s]").forEach(b => b.onclick = async () => {
      await api(`/api/drafts/${id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ statut: b.dataset.s }) });
      renderDrafts();
    });
  });
}
function wireDraftFilters() {
  view.querySelectorAll("[data-dfilter]").forEach(b => b.onclick = () => { draftFilter = b.dataset.dfilter; renderDrafts(); });
}

// --- rendu sources ---
async function renderSources() {
  const src = await api("/api/sources");
  view.innerHTML = `<table>
    <tr><th>Nom</th><th>Type</th><th>Flux</th><th>Rank</th><th>Actif</th><th>Dernier run</th></tr>
    ${src.map(s => `<tr class="${s.actif ? "" : "off"}">
      <td>${esc(s.nom)}</td><td>${s.type}</td><td>${s.flux}</td><td>${s.rank}</td>
      <td>${s.actif ? "oui" : "non"}</td><td>${s.last_run ? new Date(s.last_run).toLocaleString("fr-FR") : "—"}</td>
    </tr>`).join("")}
  </table>`;
}

function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

async function render() {
  try {
    if (tab === "sources") await renderSources();
    else if (tab === "deuwi") await renderDrafts();
    else await renderItems(tab);
  } catch (e) { view.innerHTML = `<div class="empty">Erreur: ${esc(e.message)}</div>`; }
}

document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("active", x === b));
  itemFilter = "retenu";
  render();
});

document.getElementById("curate").onclick = async () => {
  setStatus("curation Haiku…");
  try {
    const r = await api("/api/curate", { method: "POST" });
    setStatus(`curé ${r.traites}/${r.candidats} · ${r.drafts} fiches · ${r.rejetes} rejetés${r.fetch_echecs ? ` · ${r.fetch_echecs} fetch KO` : ""}${r.errors.length ? ` · ${r.errors.length} erreurs` : ""}`);
    if (tab === "deuwi") render();
  } catch (e) { setStatus("erreur curation: " + e.message); }
};

document.getElementById("run").onclick = async () => {
  setStatus("ingestion…");
  try {
    const r = await api("/api/run", { method: "POST" });
    setStatus(`+${r.inserted} items (${r.retenu} retenus, ${r.rejete} rejetés, ${r.duplicates} doublons)${r.errors.length ? `, ${r.errors.length} erreurs` : ""}`);
    render();
  } catch (e) { setStatus("erreur: " + e.message); }
};

render();
