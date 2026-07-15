const view = document.getElementById("view");
const statusEl = document.getElementById("status");
let tab = "dev";
let itemFilter = "retenu"; // retenu | rejete | all
const CHAP = { 1: "IA sait faire", 2: "marché brutal", 3: "producteur→directeur", 4: "architecture", 5: "diriger l'IA", 6: "lire/auditer", 7: "sens produit", 8: "communiquer", 9: "apprendre", 10: "auto-diagnostic", 11: "plan 90j", 12: "portfolio/CV", 13: "par profil", 14: "antifragile" };
const CHIFFRES = { ok: "OK", a_verifier: "À vérifier", inconnu: "Inconnu" };

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function setStatus(msg) { statusEl.textContent = msg; }

// --- rendu items (dev) ---
async function renderItems(flux) {
  const statutQ = itemFilter === "all" ? "" : `&statut=${itemFilter}`;
  const items = await api(`/api/items?flux=${flux}${statutQ}&limit=200`);
  const filters = `
    <div class="filters">
      ${["retenu", "rejete", "all"].map(f =>
        `<button data-filter="${f}" class="${itemFilter === f ? "active" : ""}">${f}</button>`).join("")}
    </div>`;
  if (!items.length) { view.innerHTML = filters + `<div class="empty">Aucun item. La passe quotidienne alimentera la liste.</div>`; wireFilters(flux); return; }

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

// --- rendu fiches Deuwi (lecture seule + copier) ---
function copyText(d) {
  const chap = d.chapitre ? `${d.chapitre} — ${CHAP[d.chapitre] || ""}`.trim() : "aucun";
  return [
    `Fait : ${d.fait}`,
    `Angle : ${d.angle}`,
    `Chapitre : ${chap}`,
    `Profil : ${d.profil || "—"}`,
    `Chiffres : ${CHIFFRES[d.chiffres_flag] || "—"}`,
    `Source : ${d.url}`,
  ].join("\n");
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
      <p class="src"><a href="${d.url}" target="_blank" rel="noopener">${esc(d.sources_line || d.url)}</a></p>
      <div class="draft-actions">
        <button class="copy">📋 Copier pour Notion</button>
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

// --- rendu sources ---
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

render();
