# Catalogue des sources

Statut : `✓` feed vérifié · `~` connu-stable non re-testé ici · `!` API avec clé · `✗` pas de feed → WebSearch/scrape.
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
| OpenAI Codex / news | search | requête WebSearch ciblée | ✗ | 3 |

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
| APEC — offres tech (RSS) | rss | via `cadres.apec.fr/MonCompte/Flux-RSS/` | ~ | 2 |
| APEC — études/observatoire | scrape | `https://corporate.apec.fr/toutes-nos-etudes` | ✗ | 3 |
| Free-Work blog/marché | search | pas de RSS (500 sur `/feed`) | ✗ | 2 |

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
| France Travail — API Marché du travail | api | `francetravail.io` (tensions par métier, clé requise) | ! | 3 |
| France Travail — Tensions (data.gouv) | api | dataset data.gouv.fr, trimestriel | ! | 3 |
| APEC observatoire | scrape | (ci-dessus) | ✗ | 3 |
| DARES (stats travail) | search | requête ciblée | ✗ | 3 |

---

## Détails APIs (§API)

### arXiv
Deux voies :
- **RSS par catégorie** (simple, quotidien) : `https://rss.arxiv.org/rss/{cat}` — cats utiles : `cs.SE`, `cs.AI`, `cs.HC`, `cs.DC`.
- **API query** (recherche fine) : `http://export.arxiv.org/api/query?search_query=cat:cs.SE&sortBy=submittedDate&sortOrder=descending&max_results=50` — Atom en retour.

Le RSS suffit pour la cadence hebdo. Query réservée si besoin de filtrer par mots-clés.

### Hacker News (Algolia — gratuit, sans clé)
```
https://hn.algolia.com/api/v1/search_by_date?tags=story&query=<terme>&numericFilters=points>50,created_at_i><epoch_7j>
```
Requêtes `deuwi` : `AI developer jobs`, `layoffs engineers`, `copilot`, `claude code`, `cursor`, `AI coding productivity`.
Réponse JSON → map vers `items` (titre, url, created_at, points).

### France Travail (francetravail.io) — clé requise `!`
- Créer appli sur `francetravail.io`, OAuth2 client_credentials → `NB_FT_CLIENT_ID` / `NB_FT_CLIENT_SECRET` en secrets Worker.
- API « Marché du travail » : tensions par métier (5 niveaux), dynamisme territoire, salaires. Maille : code ROME (dev ≈ `M1805` études et dev informatique / `M1802`).
- Données trimestrielles → pas besoin de cron hebdo serré ; poll mensuel suffit. Bon pour chiffres sourcés (chapitre 2 marché).

### Sources `✗` (pas de feed) → WebSearch
Free-Work, Cursor changelog, Codex/OpenAI, APEC études, DARES.
Étage 1 lance une requête `WebSearch` datée par source, dédup contre `items.hash`, garde seulement ce qui n'est pas déjà rentré par RSS/API (règle « pas de doublon » du cadrage).

---

## Seed D1 (extrait)

```sql
INSERT INTO sources (type, nom, url, flux, rank, config, actif) VALUES
-- dev / langages
('rss','Node.js blog','https://nodejs.org/en/feed/blog.xml','dev',3,NULL,1),
('rss','Rust blog','https://blog.rust-lang.org/feed.xml','dev',3,NULL,1),
('atom','Go blog','https://go.dev/blog/feed.atom','dev',3,NULL,1),
('rss','TypeScript devblog','https://devblogs.microsoft.com/typescript/feed/','dev',3,NULL,1),
-- IA outillage (both)
('atom','Claude Code releases','https://github.com/anthropics/claude-code/releases.atom','both',3,NULL,1),
('rss','GitHub changelog','https://github.blog/changelog/feed/','both',3,NULL,1),
('atom','Simon Willison','https://simonwillison.net/atom/everything/','both',2,NULL,1),
('search','Cursor changelog','cursor changelog release','both',3,'{"query":"Cursor editor changelog release"}',1),
-- web/cloud
('rss','Cloudflare blog','https://blog.cloudflare.com/rss/','dev',3,NULL,1),
('rss','React blog','https://react.dev/rss.xml','dev',3,NULL,1),
-- archi/études
('rss','arXiv cs.SE','https://rss.arxiv.org/rss/cs.SE','both',3,NULL,1),
('rss','arXiv cs.HC','https://rss.arxiv.org/rss/cs.HC','deuwi',3,NULL,1),
('rss','arXiv cs.AI','https://rss.arxiv.org/rss/cs.AI','deuwi',3,NULL,1),
('atom','Martin Fowler','https://martinfowler.com/feed.atom','dev',2,NULL,1),
('rss','METR','https://metr.org/feed.xml','deuwi',3,NULL,1),
-- marché / FR
('api','Hacker News (jobs/IA)','https://hn.algolia.com/api/v1/search_by_date','deuwi',1,'{"queries":["AI developer jobs","layoffs engineers","claude code","cursor","AI coding productivity"],"min_points":50}',1),
('api','France Travail tensions','francetravail.io/marche-du-travail','deuwi',3,'{"rome":["M1805","M1802"],"needs_secret":true}',1),
('search','Free-Work marché','free-work marché freelance dev IA','deuwi',2,'{"query":"Free-Work marché freelance développeur IA France"}',1),
('scrape','APEC études','https://corporate.apec.fr/toutes-nos-etudes','deuwi',3,NULL,1);
```

---

## Points ouverts / à décider

1. **Cursor / Codex / Anthropic news** — pas de RSS fiable. On confirme via WebSearch daté à chaque passe, ou tu me pointes un feed non officiel (ex. agrégateur) si tu en as un.
2. **France Travail clé** — tu crées l'appli sur `francetravail.io` quand tu veux le flux chiffres marché. Sinon on démarre sans (source `actif=0`).
3. **APEC / DARES scrape** — fragile. Alternative : WebSearch ciblé « APEC étude {trimestre} emploi cadres tech ». Moins de code, à voir au run.
4. **Fenêtre fraîcheur par source** — RSS quotidiens = 7j. France Travail trimestriel = poll mensuel, fraîcheur « fait récent documenté » (pas 48h).
5. **Volume HN** — `min_points` à caler (50 = bruit filtré, mais rate certains signaux tôt). Ajustable dans `config`.
