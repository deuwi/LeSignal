# Catalogue des sources

Statut : `✓` feed vérifié · `~` connu-stable non re-testé ici · `!` API avec clé · `✗` pas de feed → recherche Brave.
`rank` : 3 = source primaire (étude, données officielles, changelog éditeur) · 2 = éditorial fiable · 1 = agrégateur.

---

## Flux `dev` — veille perso

### Langages / runtime
| Source | Type | URL | Statut | rank |
|---|---|---|---|---|
| Node.js blog | rss | `https://nodejs.org/en/feed/blog.xml` | ~ | 3 |
| TypeScript devblog | rss | `https://devblogs.microsoft.com/typescript/feed/` | ~ | 3 |
| Rust blog | rss | `https://blog.rust-lang.org/feed.xml` | ~ | 3 |
| Go blog | atom | `https://go.dev/blog/feed.atom` | ~ | 3 |
| Bun releases | atom | `https://github.com/oven-sh/bun/releases.atom` | ~ | 3 |
| Deno releases | atom | `https://github.com/denoland/deno/releases.atom` | ~ | 3 |

### IA outillage dev  (recoupe `deuwi` — flux=`both`)
| Source | Type | URL | Statut | rank |
|---|---|---|---|---|
| Claude Code releases | atom | `https://github.com/anthropics/claude-code/releases.atom` | ~ | 3 |
| GitHub changelog (Copilot etc.) | rss | `https://github.blog/changelog/feed/` | ~ | 3 |
| MCP spec/releases | atom | `https://github.com/modelcontextprotocol/modelcontextprotocol/releases.atom` | ~ | 3 |
| Simon Willison (AI/dev) | atom | `https://simonwillison.net/atom/everything/` | ~ | 2 |
| Cursor changelog | search | `cursor.com/changelog` (pas de RSS) | ✗ | 3 |
| OpenAI Codex / news | search | requête Brave ciblée | ✗ | 3 |

### Web / Cloud / infra
| Source | Type | URL | Statut | rank |
|---|---|---|---|---|
| Cloudflare blog | rss | `https://blog.cloudflare.com/rss/` | ~ | 3 |
| React blog | rss | `https://react.dev/rss.xml` | ~ | 3 |
| web.dev (Chrome) | rss | `https://web.dev/static/blog/feed.xml` | ~ | 2 |

### Fondamentaux / archi
| Source | Type | URL | Statut | rank |
|---|---|---|---|---|
| arXiv cs.SE | rss | `https://rss.arxiv.org/rss/cs.SE` | ✓ | 3 |
| arXiv cs.DC (distribué) | rss | `https://rss.arxiv.org/rss/cs.DC` | ~ | 3 |
| Martin Fowler | atom | `https://martinfowler.com/feed.atom` | ~ | 2 |
| Hacker News (front, ≥score) | api | Algolia (voir §API) | ~ | 1 |

---

## Flux `deuwi` — curation BRIQUE

### 1. Outils code IA (sorties, features, benchmarks)
→ mêmes sources que « IA outillage dev » ci-dessus (`flux=both`).
Ajout benchmarks : arXiv cs.SE (agents/codegen déjà couvert par le feed).

### 2. Marché emploi dev / tech lead
| Source | Type | URL | Statut | rank |
|---|---|---|---|---|
| HN « hiring / layoffs / AI jobs » | api | Algolia `query` filtré (voir §API) | ~ | 1 |
| APEC — études/marché | search | requête Brave (pas de RSS/feed exploitable, page JS) | ✗ | 3 |
| Free-Work marché | search | requête Brave (pas de RSS, 500 sur `/feed`) | ✗ | 2 |

### 3. Études productivité & compétences
| Source | Type | URL | Statut | rank |
|---|---|---|---|---|
| METR blog | rss | `https://metr.org/feed.xml` | ✓ | 3 |
| arXiv cs.SE | rss | (déjà listé) | ✓ | 3 |
| arXiv cs.HC (facteur humain) | rss | `https://rss.arxiv.org/rss/cs.HC` | ~ | 3 |
| arXiv cs.AI | rss | `https://rss.arxiv.org/rss/cs.AI` | ~ | 3 |

### 4. Signaux francophones (emploi)
| Source | Type | URL | Statut | rank |
|---|---|---|---|---|
| France Travail — offres dev | api | API Offres, volume actif par code ROME (clé) | ! | 3 |
| France Travail — tension recrutement | api | API Marché du travail, indicateur PERSP_2 niveau 1–5 par ROME (clé) | ! | 3 |
| APEC études/marché | search | (voir §2 — requête Brave) | ✗ | 3 |

### 5. Signaux de recherche émergents (Google Trends)
| Source | Type | URL | Statut | rank |
|---|---|---|---|---|
| Google Trends — `related_queries` (rising/breakout) | push | poussé via `POST /api/ingest-trends` (fetch **hors** Worker) | ! | 1 |

---

## Détails APIs (§API)

### arXiv
Deux voies :
- **RSS par catégorie** (simple, quotidien) : `https://rss.arxiv.org/rss/{cat}` — cats utiles : `cs.SE`, `cs.AI`, `cs.HC`, `cs.DC`.
- **API query** (recherche fine) : `http://export.arxiv.org/api/query?search_query=cat:cs.SE&sortBy=submittedDate&sortOrder=descending&max_results=50` — Atom en retour.

Le RSS suffit pour la passe quotidienne. Query réservée si besoin de filtrer par mots-clés.

### Hacker News (Algolia — gratuit, sans clé)
```
https://hn.algolia.com/api/v1/search_by_date?tags=story&query=<terme>&numericFilters=points>50,created_at_i><epoch_7j>
```
Requêtes `deuwi` (config source) : `AI developer jobs`, `layoffs engineers`, `claude code`, `cursor AI`, `AI coding productivity`.
Réponse JSON → map vers `items` (titre, url, created_at, points).

### France Travail (francetravail.io) — clé requise `!`
- Créer une appli sur `francetravail.io`, y **associer** les API voulues, OAuth2
  client_credentials (realm `/partenaire`, hôte token `entreprise.pole-emploi.fr`)
  → `FT_CLIENT_ID` / `FT_CLIENT_SECRET` en secrets Worker.
- Scopes (obligatoire `api_…` + droit applicatif) — confirmés en prod :
  - Offres : `api_offresdemploiv2 o2dsoffre`
  - Marché du travail : `api_stats-offres-demandes-emploiv1 offresetdemandesemploi`
- **Implémenté** (source `deuwi`, passe mensuelle) :
  - **Volume d'offres** actives par code ROME (API Offres, en-tête `Content-Range`).
  - **Tension de recrutement** par métier (API Marché du travail, indicateur
    `PERSP_2`, synthèse `PERSPECTIVE`, niveau 1–5, France entière).
- Maille : code ROME dev, éditable en config (défaut `M1805`, `M1802`, `M1810`,
  `M1806`), libellés récupérés dynamiquement. Chiffres sourcés (chapitre 2 marché).

### Google Trends — `related_queries` (rising/breakout) → push + Google Sheet
Le fetch Trends **n'est pas fait par le Worker** : depuis une IP datacenter Cloudflare,
l'endpoint interne renvoie le mur `/sorry/` (CAPTCHA anti-bot). Un script externe
(`trend_watch.py`, IP résidentielle) récupère `related_queries` et **pousse** les signaux :
```
POST /api/ingest-trends   (admin-gated, en-tête X-Admin-Token)
body: { "signals": [{seed,geo,query,value,breakout}], "date"?: "YYYY-MM-DD" }
```
- **Ingestion** : tous les signaux (rising + breakout) passent le pipeline standard
  (dédup `items.hash` → pré-filtre → catégorisation → insert), sous `source_id=26`, `flux=deuwi`.
- **Sortie Google Sheet** (breakouts seulement) : écriture auto « à trier » via l'API REST
  Sheets. Auth service account — JWT RS256 signé **Web Crypto** (`crypto.subtle`, Workers
  n'a pas `node:crypto`), token OAuth, `values/A:I:append` (USER_ENTERED / INSERT_ROWS).
  Secrets `GOOGLE_SA_KEY` (JSON du SA) + `SHEETS_ID` ; partager le Sheet en éditeur avec
  le `client_email` du SA. Dédup avant écriture : rejet si `(titre,type)` existe, ou si le
  `titre` seul existe (anti-doublon rising/breakout d'un même terme). Sans secrets, la sortie
  Sheet est ignorée (l'ingestion, elle, continue). Remplace l'ancienne sortie Notion.
- **Exclu** : « Trending Now » (scraping `trends.google.com/trending`, fragile) — hors prod.

### Sources `✗` (pas de feed) → recherche Brave
Cursor changelog, OpenAI Codex, Free-Work marché, APEC études.
Étage 1 lance une requête **Brave Search** (`freshness=pw`) datée par source, dédup
contre `items.hash`, garde seulement ce qui n'est pas déjà rentré par RSS/API (règle
« pas de doublon » du cadrage). Sans `BRAVE_API_KEY`, ces sources sont ignorées.

---

## Seed D1 (extrait — voir [`migrations/0002_seed_sources.sql`](migrations/0002_seed_sources.sql) pour la liste complète, 25 sources)

Le seed réel utilise des `id` explicites + `INSERT OR REPLACE` (idempotent, FK-safe).
Extrait des entrées à config :

```sql
-- IA outillage (search Brave)
('search','Cursor changelog','Cursor editor changelog release','both',3,'{"query":"Cursor editor changelog release features"}',1),
('search','OpenAI Codex news','OpenAI Codex coding agent release','both',3,'{"query":"OpenAI Codex coding agent release"}',1),
-- marché / FR
('api','Hacker News','https://hn.algolia.com/api/v1/search_by_date','deuwi',1,'{"kind":"hn","queries":["AI developer jobs","layoffs engineers","claude code","cursor AI","AI coding productivity"],"min_points":50}',1),
('api','France Travail — offres dev','francetravail.io','deuwi',3,'{"kind":"francetravail","romeCodes":["M1805","M1802","M1810","M1806"],"territoire":{"type":"NAT","code":"FR"}}',1),
('search','Free-Work marché','Free-Work marché freelance développeur IA','deuwi',2,'{"query":"Free-Work marché freelance développeur IA France"}',1),
('search','APEC études','APEC étude emploi cadres','deuwi',3,'{"query":"APEC étude emploi cadres marché"}',1);
```

La source France Travail (`kind:"francetravail"`) déclenche **volume d'offres + tension**
en une seule entrée (voir §API).

---

## Points ouverts / à décider

1. **Cursor / Codex news** — pas de RSS fiable → recherche **Brave** datée (`freshness=pw`) à chaque passe. ✅ en place.
2. **France Travail** — appli créée, API Offres + Marché du travail associées, clés en secrets. ✅ volume + tension en prod (passe mensuelle).
3. **APEC** — page études en JS (pas scrapable simplement) → repliée sur recherche **Brave**. ✅ en place. DARES : non implémenté (abandonné).
4. **Fenêtre fraîcheur par source** — RSS quotidiens = 7j. France Travail = poll mensuel (garde-fou `ranWithin("ft", 25j)`), chiffres « fait récent documenté ».
5. **Volume HN** — `min_points` à caler (50 = bruit filtré, mais rate certains signaux tôt). Ajustable dans le `config` de la source.
