const view = document.getElementById("view");
const statusEl = document.getElementById("status");
let tab = "dev";
let itemFilter = "retenu"; // retenu | rejete | all

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
    else await renderItems(tab);
  } catch (e) { view.innerHTML = `<div class="empty">Erreur: ${esc(e.message)}</div>`; }
}

document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("active", x === b));
  itemFilter = "retenu";
  render();
});

document.getElementById("run").onclick = async () => {
  setStatus("ingestion…");
  try {
    const r = await api("/api/run", { method: "POST" });
    setStatus(`+${r.inserted} items (${r.retenu} retenus, ${r.rejete} rejetés, ${r.duplicates} doublons)${r.errors.length ? `, ${r.errors.length} erreurs` : ""}`);
    render();
  } catch (e) { setStatus("erreur: " + e.message); }
};

render();
