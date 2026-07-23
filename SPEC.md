# Le Signal — Spécification de conception

> App de veille dev + pipeline de curation « Project Deuwi ».
> Une app, deux flux. Cloudflare, budget mini.
>
> Ce document reflète l'**implémentation actuelle** (déployée sur
> [signal.deuwi.xyz](https://signal.deuwi.xyz)), pas seulement l'intention de
> départ. Les décisions revues en cours de route sont notées comme telles.

---

## 1. Intention

Deux besoins dans une seule app, infra partagée :

1. **Flux `dev`** — veille dev perso pour rester affûté. Large, lecture rapide, pas de curation lourde.
2. **Flux `deuwi`** — pipeline de curation de la BRIQUE VEILLE. Alimente le Project Deuwi (livre + LinkedIn) en signaux frais, sélectionnés, vérifiés. Chaque sortie = angle de post prêt.

### Thèse directrice (fil rouge du flux `deuwi`)
> « L'IA ne prendra pas ton job. Quelqu'un qui la dirige mieux que toi, si.
> Sans hype, sans déni. »
>
> Le métier mute, il ne meurt pas.

### Cible (4 profils)
- `junior` — face au silence du marché
- `confirme` — dont le confort est un piège
- `reconverti` — à qui on a dit « trop tard »
- `freelance` — dont les clients demandent « pourquoi pas l'IA »

---

## 2. Décisions cadrées

| Sujet | Décision |
|---|---|
| Form factor | Web app dashboard (vanilla JS, zéro build) |
| Automatisation | L'app propose (lecture seule publique) ; l'humain copie-colle / valide |
| Sources | RSS/Atom + APIs (Hacker News, France Travail) + recherche Brave (gaps FR/outils) |
| Sortie | Notion — **lecture** (exclusion) + **écriture** optionnelle (bouton, admin) + copie CSV |
| Stack | Cloudflare **Workers + Hono + D1 + Cron + Workers Assets** (pas de Queues ni Pages) |
| Repo | `~/Workspace/veille`, GitHub `deuwi/LeSignal` (public) |
| Périmètre | Une app, 2 flux (`dev` + `deuwi`) |
| Budget LLM | Minimal — Haiku, pré-filtre heuristique avant tout token |
| Moteur LLM | Clé API Anthropic (Haiku : score + draft + traduction EN) |
| Hosting | Cloudflare, custom domain `signal.deuwi.xyz` |
| Cadence | Passe quotidienne **cron 07:00 UTC** ; déclenchement manuel admin-gated |
| I18n / thème | Interface bilingue FR/EN + mode clair/sombre |
| Domaines `dev` | Langages/runtime, IA outillage dev, Web/Cloud/infra, Fondamentaux/archi |

---

## 3. Architecture

Passe **synchrone** dans une seule invocation Worker (`runDaily`), pas de Queues.
Déclenchée par le cron ou en manuel (`POST /api/daily`, admin, fire-and-forget via
`waitUntil`).

```
┌──────────────────────────────────────────────────────────────┐
│  Cron 07:00 UTC   +   POST /api/daily (admin, ?force=1)        │
└───────────────────────────┬──────────────────────────────────┘
                            │  runDaily(env) — stamp('daily') d'abord
                     ┌──────▼────────────────────────────────┐
  ÉTAGE 1 INGEST     │  runIngest : boucle sources actives    │
  (gratuit)          │  rss/atom → feeds · api → HN / France   │
                     │  Travail · search → Brave              │
                     └──────┬────────────────────────────────┘
                            │  par item : hash, pré-filtre 0 token,
                            │  catégorisation, extraction liens
   ÉTAGE 2 DEDUP+FILTRE     │  INSERT batch (lots de 50, ON CONFLICT hash)
   (gratuit)          ┌─────▼──────┐
                     │  D1: items  │  statut=retenu | rejete (+ categories, links)
                     └─────┬──────┘
                           │  flux=deuwi retenus, hors URLs déjà sur Notion
   ÉTAGE 3 SCORE           │  runCurate : fetch source complète + Haiku
   (Haiku)           ┌─────▼──────┐  (pertinent, chapitre, profil, chiffres, score)
                     │ D1: verdicts│
                     └─────┬──────┘
   ÉTAGE 4 DRAFT           │  Haiku : fait + angle + sources_line + fait_en + angle_en
   (Haiku)           ┌─────▼──────┐
                     │ D1: drafts  │  statut=propose
                     └─────┬──────┘
                           │
                     ┌─────▼───────────────────────────┐
                     │ Dashboard (Workers Assets)       │  lecture seule publique
                     │  Copier CSV · Créer dans Notion  │  (écriture admin-gated)
                     └─────┬───────────────────────────┘
                           │  Notion : lecture (exclusion) + écriture optionnelle
                     ┌─────▼──────┐
                     │   Notion    │  fiches sur Notion → drafts.statut=dans_notion
                     └────────────┘
```

Le flux `dev` s'arrête à l'étage 2 : ingestion + dedup + catégorisation + lecture
dashboard. Pas de curation LLM (économie de tokens).

**Limite Workers** : ~1000 sous-requêtes/invocation. Un INSERT par item épuisait le
quota → inserts groupés `env.DB.batch` par lots de 50.

---

## 4. Modèle de données (D1)

```sql
CREATE TABLE sources (
  id        INTEGER PRIMARY KEY,
  type      TEXT NOT NULL,        -- rss | api | search
  nom       TEXT NOT NULL,
  url       TEXT NOT NULL,        -- feed url, api endpoint, ou requête search
  flux      TEXT NOT NULL,        -- dev | deuwi | both
  rank      INTEGER DEFAULT 0,    -- priorité source (primaire > agrégateur SEO)
  config    TEXT,                 -- JSON: params API (arxiv cat, github repo…)
  actif     INTEGER DEFAULT 1,
  last_run  TEXT
);

CREATE TABLE items (
  id         INTEGER PRIMARY KEY,
  source_id  INTEGER REFERENCES sources(id),
  url        TEXT NOT NULL,
  titre      TEXT NOT NULL,
  resume     TEXT,                -- extrait du feed (nettoyé, ≤600c)
  contenu    TEXT,                -- réservé (fetch complet étage 3)
  date_pub   TEXT,
  hash       TEXT UNIQUE,         -- dedup (url normalisée + titre)
  flux       TEXT NOT NULL,
  statut     TEXT DEFAULT 'brut', -- brut | retenu | rejete
  raison_rejet TEXT,              -- ex: 'hors-fraicheur', 'deja-notion'
  lu         INTEGER DEFAULT 0,   -- lecture perso flux dev
  favori     INTEGER DEFAULT 0,   -- ★ flux dev
  categories TEXT,                -- JSON: noms de catégories (migration 0004)
  links      TEXT,                -- JSON: URLs de référence extraites (migration 0004)
  cree_le    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE verdicts (
  item_id      INTEGER PRIMARY KEY REFERENCES items(id),
  pertinent    INTEGER,           -- 0/1
  chapitre     INTEGER,           -- 1-14, ou NULL (= "aucun")
  profil       TEXT,              -- junior | confirme | reconverti | freelance
  chiffres_flag TEXT,             -- ok | a_verifier | inconnu
  score        REAL,
  raw_llm      TEXT,              -- réponse Haiku brute (debug)
  cree_le      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE drafts (
  item_id      INTEGER PRIMARY KEY REFERENCES items(id),
  fait         TEXT,              -- 1 ligne + source datée (FR)
  angle        TEXT,              -- angle de post aligné thèse + profil (FR)
  fait_en      TEXT,              -- version EN (migration 0005)
  angle_en     TEXT,              -- version EN (migration 0005)
  sources_line TEXT,              -- ligne de sources finale
  statut       TEXT DEFAULT 'propose', -- propose | dans_notion
  notion_id    TEXT,              -- id page Notion après écriture
  edite_le     TEXT
);
```

> Statuts réels alimentés par le code : `items` = `retenu`/`rejete` ; `drafts` =
> `propose` (généré) → `dans_notion` (créé/repéré sur Notion). Les défauts
> `'brut'`/`'brouillon'` du schéma initial ne sont pas utilisés en pratique.

Dedup : `hash = sha1(normalize(url) + '|' + normalize(titre))`. `normalize` = lowercase, strip UTM/query tracking, trim.

---

## 5. Étage 2 — Pré-filtre heuristique (0 token)

> **Config pilotable** : fraîcheur, exclusions, mots-clés thèse et **catégories dev** sont éditables via l'onglet **Réglages** (stockés en DB `app_state['config']`, défauts dans `src/config.ts`). Plus de regex codées en dur subies : tu as la main. Appliqué à la passe suivante.

Ordre BRIQUE, appliqué en code avant tout LLM :

1. **Fraîcheur** — `date_pub` dans fenêtre. Défaut 7j (`FRESHNESS_DAYS`), item hors fenêtre → `rejete:hors-fraicheur`.
2. **Exclusions dures** — regex sur titre+resume. Match = `rejete` immédiat, jamais de token dépensé :
   ```
   /\b(apple|iphone|ipad|macos|vision ?pro)\b/i          → apple
   /\b(formation|devenez|gagnez? \d+k|10\s?000\s?€)\b/i   → formation-10k
   /\b(l'ia va (tuer|remplacer|détruire))\b/i             → peur-artificielle
   /\b(élections?|gouvernement|ministre|polémique)\b/i    → politique
   ```
   (liste affinée à l'usage, stockée en config)
3. **Pertinence thèse (entrée `deuwi`)** — au moins un signal parmi : outils code IA, marché emploi dev, étude productivité/compétences, signaux FR emploi. Regex large + liste de mots-clés. Pas de match → `rejete:hors-these` (mais gardé consultable, pas supprimé).
4. **Rank source** — tri par `sources.rank` : primaire (arXiv, données officielles) devant agrégateur SEO. Sert l'ordre de traitement et le tri dashboard.

Le pré-filtre **coupe le volume, pas par count** — aucun `LIMIT` artificiel. C'est la pertinence qui filtre, pas un quota.

---

## 6. Étage 3 — Fetch + score LLM (Haiku)

**Fetch OBLIGATOIRE de la source complète avant d'écrire** (règle BRIQUE). Remplit `items.contenu`. Sans fetch réussi → pas de score, item marqué `a_verifier`.

Prompt Haiku (score), entrée = titre + contenu complet :

```
Tu filtres une veille pour un livre sur la mutation du métier de dev face à l'IA.
Thèse: "L'IA ne prend pas ton job; quelqu'un qui la dirige mieux que toi, si."
Cible: junior, confirmé, reconverti, freelance (dev/tech lead francophones).

Évalue cet item. Réponds JSON strict:
{
  "pertinent": bool,        // parle à un profil OU éclaire la mutation du métier
  "chapitre": int|null,     // 1-14 si correspondance nette, sinon null
  "profil": "junior"|"confirme"|"reconverti"|"freelance"|null,
  "chiffres_flag": "ok"|"a_verifier"|"inconnu",
    // ok: tout chiffre du contenu est sourcé dans le texte
    // a_verifier: chiffre présent mais source imprécise
    // inconnu: pas de chiffre / non vérifiable
  "score": 0.0-1.0
}
Chapitres: 1 ce que l'IA sait faire · 2 marché brutal · 3 producteur→directeur ·
4 architecture · 5 diriger l'IA · 6 lire/auditer/déboguer · 7 sens produit ·
8 communiquer · 9 apprendre à apprendre · 10 auto-diagnostic · 11 plan 90j ·
12 portfolio/CV/entretiens · 13 stratégies par profil · 14 carrière antifragile.

CONTENU:
{contenu}
```

`pertinent=false` → `statut=rejete`, pas d'étage 4. Le chapitre n'est PAS requis pour retenir (BRIQUE : l'appartenance chapitre n'est pas un filtre).

---

## 7. Étage 4 — Draft angle (Haiku)

Seulement si `pertinent=true`. Prompt :

```
Rédige la fiche de veille. Aligne l'angle sur la thèse ET un profil précis.
Ton: sans hype, sans peur, factuel. Français.

Réponds JSON:
{
  "fait": "1 ligne factuelle + (source, date)",
  "angle": "angle de post concret aligné thèse + profil ciblé",
  "sources_line": "Sources: <titre> — <url> (<date>)"
}
Tout chiffre non sourcé proprement dans le contenu: écris 'À VÉRIFIER' au lieu du chiffre.
Chapitre rattaché: {chapitre ou "aucun"}. Profil: {profil}.

CONTENU: {contenu}
```

Résultat → `drafts`, `statut=propose`. **Jamais publié automatiquement** : l'humain
relit, puis copie-colle (CSV) ou crée la page Notion à la demande.

> **Révision (pivot)** : le modèle « kanban valider/jeter/éditer/push » a été abandonné
> au profit d'une **liste de propositions en lecture seule côté public**. L'app propose ;
> l'humain exporte. Deux sorties Notion coexistent : **lecture** (exclusion des sujets
> déjà traités) et **écriture optionnelle** (bouton « Créer dans Notion », protégé par
> `ADMIN_TOKEN`). Voir §8-9.
>
> La curation Haiku génère aussi la **version EN** (fait/angle) en même temps que la FR
> (migration 0005 ; endpoint `POST /api/backfill-en` pour les fiches antérieures).

---

## 8. Dashboard (vanilla JS → Workers Assets)

Interface éditoriale **« Le Signal »** (charte périodique imprimé), **bilingue FR/EN**
(sélecteur), **mode clair/sombre** (préférence système par défaut, choix mémorisé en
`localStorage`). Aucun build.

**Aucun bouton d'exécution public** (ingestion/curation) : tout passe par la passe
quotidienne (cron). Le déclenchement manuel existe mais est **admin-gated**
(`POST /api/daily`, en-tête `X-Admin-Token`).

Navigation (2 onglets) + pied de page :
- **Dev** — **chips de catégories** (langages, IA outillage, web, cloud, backend, sécu,
  devops, archi… + ★ Favoris) en filtre principal, statut (retenu/rejeté/tout) en
  secondaire. Carte = titre-lien, **résumé dépliable**, **liens de référence**, tags
  catégories, favori ★.
- **Atelier Deuwi** — liste **lecture seule** des fiches `propose` (triées par score).
  Carte = Fait, angle, chapitre-tag, profil-badge, flag chiffres, lien source, liens de
  référence, bouton **Copier** (CSV) et **Créer dans Notion** (admin). En EN, affiche
  `fait_en`/`angle_en` (repli FR). Les fiches `dans_notion` sont masquées.
- **Pied de page** — boutons **Sources** (table : type, flux, rank, actif, dernière
  passe) et **Réglages** (édition config : fraîcheur, mots-clés thèse, exclusions,
  catégories ; Enregistrer / Réinitialiser, admin), + lien LinkedIn.

**Liens de référence** : chaque item porte `links` (JSON) — URLs extraites du
`content:encoded`/`description` du feed (flux dev) et de la page source complète
(curation Deuwi). Externes priorisées. `safeUrl` côté client bloque `javascript:`/`data:`.

Format « Copier » (presse-papier, **CSV** — colonnes séparées pour Notion) :
```
Fait,Angle,Chapitre,Profil,Chiffres,Source
```

---

## 9. Notion — lecture (exclusion) + écriture (optionnelle)

**Lecture (exclusion)** — la base sert de référentiel des sujets déjà traités :
- Passe quotidienne : `POST /v1/databases/{id}/query` (paginé), extrait la propriété
  **`Source`** (URL) de chaque page → `Set` d'URLs normalisées.
- Curation : tout item dont l'URL est dans ce set est **exclu avant scoring** → tokens
  économisés. Fiches désormais sur Notion → `drafts.statut=dans_notion` (masquées).

**Écriture (à la demande, admin)** — `POST /api/drafts/:id/notion` (protégé
`ADMIN_TOKEN`) crée la page via `createNotionPage` : `Fait` (title), `Angle`/`Chapitre`/
`Profil`/`Chiffres` (rich_text), `Source` (url). Ré-appel idempotent (renvoie le
`notion_id` existant). La copie CSV reste le repli manuel.

> **Pourquoi l'écriture directe** : le copier-coller multi-colonnes dans une base Notion
> ne se répartit pas de façon fiable en colonnes. L'écriture API contourne le problème.

Contrainte côté base : une propriété **`Source`** de type **URL**. Base à partager avec
l'intégration (⋯ → Connections), sinon 404. Auth : `NOTION_TOKEN` + `NOTION_DB_ID` en
secrets Worker. Sans token, l'app tourne sans exclusion ni écriture (le flux `dev` n'est
pas affecté).

---

## 10. Coût & free-tier

- **Ingestion / dedup / filtre** : 0 token, 0 $. Pur code Worker + D1.
- **Haiku** : seulement sur shortlist post-filtre, hors sujets déjà sur Notion (exclus avant scoring). Une passe quotidienne sur ~20-40 items × (score + draft) ≈ quelques centimes.
- **D1 / Workers / Cron / Assets** : free tier Cloudflare largement suffisant à ce volume.
- Secrets (`wrangler secret put`) : `ANTHROPIC_API_KEY` (requis), `NOTION_TOKEN` +
  `NOTION_DB_ID`, `ADMIN_TOKEN`, `BRAVE_API_KEY`, `FT_CLIENT_ID` + `FT_CLIENT_SECRET`,
  `GOOGLE_SA_KEY` + `SHEETS_ID` (sortie Sheet des signaux Trends) — tous optionnels
  sauf Anthropic.

Levier coût principal : la qualité du pré-filtre étage 2. Plus il coupe juste, moins Haiku tourne.

---

## 11. Roadmap (réalisée)

- **Phase 1 — socle** ✅ Worker + D1 + schema + sources RSS/Atom + dedup + dashboard.
- **Phase 2 — pipeline `deuwi`** ✅ étages 2-3-4, prompts Haiku, flags chiffres (le
  kanban de validation a été abandonné → lecture seule, cf. §7).
- **Phase 3 — Notion** ✅ lecture (exclusion) + écriture optionnelle (§9).
- **Phase 4 — cron + polish** ✅ cron quotidien, affinage exclusions, rank sources,
  recherche Brave pour les gaps.

---

## 12. Ajouts post-cadrage (en prod)

Fonctionnalités arrivées après le cadrage initial, toutes déployées :

- **Sources recherche (Brave Search API)** — `freshness=pw`, pour les sources sans RSS
  (Cursor, Codex, Free-Work, APEC). Clé `BRAVE_API_KEY` ; absente → sources ignorées.
- **France Travail** (source `deuwi`, passe **mensuelle**, garde-fou `ranWithin("ft",25j)`) :
  - **Volume d'offres** actives par code ROME (API Offres, en-tête `Content-Range`).
  - **Tension de recrutement** par métier (API Marché du travail, indicateur `PERSP_2`,
    synthèse `PERSPECTIVE`, niveau 1–5, France entière).
  - OAuth2 client_credentials (`entreprise.pole-emploi.fr`, realm `/partenaire`).
    Scopes : `api_offresdemploiv2 o2dsoffre` (offres),
    `api_stats-offres-demandes-emploiv1 offresetdemandesemploi` (marché). Codes ROME et
    territoire **éditables en config** (pas figés dans le code).
- **Bilingue FR/EN** — Haiku génère `fait_en`/`angle_en` à la curation ; chrome de l'UI
  traduit ; `POST /api/backfill-en` pour l'historique.
- **Mode clair/sombre** — préférence système + choix mémorisé.
- **Google Trends** (source `deuwi`, signaux `related_queries` rising/breakout) — fetch
  **hors Worker** (IP datacenter Cloudflare bloquée par le mur `/sorry/`), signaux poussés
  via `POST /api/ingest-trends` (admin-gated) puis passés au pipeline standard. Les
  **breakouts** sont écrits dans un **Google Sheet** (« à trier ») : JWT RS256 signé Web
  Crypto → token OAuth service account → `values/A:I:append` ; dédup `(titre,type)` + titre
  seul avant écriture ; secrets `GOOGLE_SA_KEY` + `SHEETS_ID`. Remplace l'ancienne sortie
  Notion (base « Signaux Trends », abandonnée). « Trending Now » exclu (scraping fragile).

### Sécurité (app publique, repo public)

- **Séparation lecture/écriture** : lectures + dashboard en `GET` public ; toute
  écriture/dépense (`daily`, `config` PUT/DELETE, `flag`, `drafts/:id/notion`,
  `backfill-en`, `ingest-trends`) protégée par `ADMIN_TOKEN` (en-tête `X-Admin-Token`, comparaison à
  **temps constant** SHA-256, cf. `src/auth.ts`).
- **Rate-limiting** : règle WAF Cloudflare (edge, avant le Worker) sur `/api/*`.
- **Défenses** : SQL paramétré ; `processEntities:false` sur le parseur XML ; bornes de
  config anti-ReDoS ; `safeUrl` client ; erreurs internes loggées serveur, message
  générique au client.
- **Aucun secret dans le dépôt** (`.dev.vars` gitignoré, secrets via `wrangler`).
