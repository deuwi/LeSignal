# Veille — Spécification de conception

> App de veille dev + pipeline de curation « Project Deuwi ».
> Une app, deux flux. Cloudflare, budget mini, semi-assisté.

---

## 1. Intention

Deux besoins dans une seule app, infra partagée :

1. **Flux `dev`** — veille dev perso pour rester affûté. Large, lecture rapide, pas de curation lourde.
2. **Flux `deuwi`** — pipeline de curation de la BRIQUE VEILLE. Alimente le Project Deuwi (livre + LinkedIn) en signaux frais, sélectionnés, vérifiés. Chaque sortie = angle de post prêt.

### Thèse directrice (fil rouge du flux `deuwi`)
> « L'IA ne prendra pas ton job. Quelqu'un qui la dirige mieux que toi, si. »
> Sans hype, sans déni. Le métier mute, il ne meurt pas.

### Cible (4 profils)
- `junior` — face au silence du marché
- `confirme` — dont le confort est un piège
- `reconverti` — à qui on a dit « trop tard »
- `freelance` — dont les clients demandent « pourquoi pas l'IA »

---

## 2. Décisions cadrées

| Sujet | Décision |
|---|---|
| Form factor | Web app dashboard |
| Automatisation | Semi-assisté (l'app propose, l'humain valide) |
| Sources | RSS/Atom + APIs dédiées + WebSearch (gaps FR uniquement) |
| Sortie | Notion (schéma défini ci-dessous) |
| Stack | Cloudflare Workers + Hono + D1 + Queues + Cron + Pages |
| Repo | Nouveau, `/home/deuwi/veille` (séparé de creators-cabinet) |
| Périmètre | Une app, 2 flux (`dev` + `deuwi`) |
| Budget LLM | Minimal — Haiku, pré-filtre heuristique avant tout token |
| Moteur LLM | Clé API Anthropic dans l'app (Haiku), cron auto possible |
| Hosting | Cloudflare déployé |
| Cadence | Hebdo auto + déclenchement manuel |
| Domaines `dev` | Langages/runtime, IA outillage dev, Web/Cloud/infra, Fondamentaux/archi |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Cron Trigger (hebdo)  +  POST /run (manuel depuis dashboard) │
└───────────────────────────┬─────────────────────────────────┘
                            │  enqueue par source
                     ┌──────▼───────┐
                     │  Queue: ingest│
                     └──────┬───────┘
   ÉTAGE 1 INGEST (gratuit) │  fetch RSS/API/search → items bruts
                     ┌──────▼───────┐
                     │   D1: items   │  statut=brut
                     └──────┬───────┘
   ÉTAGE 2 DEDUP+FILTRE     │  hash, fraîcheur, regex thèse/exclusions (0 token)
   (gratuit)          ┌─────▼──────┐
                     │ shortlist   │  statut=retenu | rejeté
                     └─────┬──────┘
                           │  enqueue shortlist (flux=deuwi seulement)
                     ┌─────▼──────────┐
                     │ Queue: curate   │
                     └─────┬──────────┘
   ÉTAGE 3 FETCH+SCORE     │  fetch source COMPLÈTE + Haiku (pertinence, chapitre, chiffres)
   (Haiku)           ┌─────▼──────┐
                     │ D1: verdicts│
                     └─────┬──────┘
   ÉTAGE 4 DRAFT           │  Haiku: Fait + angle + profil + sources_line
   (Haiku)           ┌─────▼──────┐
                     │ D1: drafts  │  statut=brouillon
                     └─────┬──────┘
                           │
                     ┌─────▼─────────────┐
                     │  Dashboard (Pages) │  humain valide/réécrit
                     └─────┬─────────────┘
                           │  statut=validé
                     ┌─────▼──────┐
                     │ Notion sync │
                     └────────────┘
```

Le flux `dev` s'arrête à l'étage 2 : ingestion + dedup + lecture dashboard. Pas de curation LLM (économie de tokens). Option future : résumé Haiku à la demande sur un item `dev`.

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
  resume     TEXT,                -- extrait du feed
  contenu    TEXT,                -- rempli à l'étage 3 (fetch complet)
  date_pub   TEXT,
  hash       TEXT UNIQUE,         -- dedup (url normalisée + titre)
  flux       TEXT NOT NULL,
  statut     TEXT DEFAULT 'brut', -- brut | retenu | rejete | curé
  raison_rejet TEXT,              -- ex: 'exclusion:apple', 'hors-fraicheur'
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
  fait         TEXT,              -- 1 ligne + source datée
  angle        TEXT,              -- angle de post aligné thèse + profil
  sources_line TEXT,              -- ligne de sources finale
  statut       TEXT DEFAULT 'brouillon', -- brouillon | valide | jete
  notion_id    TEXT,              -- id page Notion après sync
  edite_le     TEXT
);
```

Dedup : `hash = sha1(normalize(url) + '|' + normalize(titre))`. `normalize` = lowercase, strip UTM/query tracking, trim.

---

## 5. Étage 2 — Pré-filtre heuristique (0 token)

> **Config pilotable** : fraîcheur, exclusions, mots-clés thèse et **catégories dev** sont éditables via l'onglet **Réglages** (stockés en DB `app_state['config']`, défauts dans `src/config.ts`). Plus de regex codées en dur subies : tu as la main. Appliqué à la passe suivante.

Ordre BRIQUE, appliqué en code avant tout LLM :

1. **Fraîcheur** — `date_pub` dans fenêtre. Défaut 7j (cadence hebdo), item hors fenêtre → `rejete:hors-fraicheur` sauf si tag `fond`.
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

Résultat → `drafts`, `statut=propose`. **Jamais publié tel quel** : l'humain copie-colle dans Notion après relecture.

> **Révision (pivot)** : le modèle est passé de « semi-assisté avec validation/écriture Notion » à **source de propositions en lecture seule**. Plus de valider/jeter/éditer/push. L'app propose, l'humain copie-colle dans Notion, et Notion sert de référentiel d'exclusion. Voir §8-9.

---

## 8. Dashboard (vanilla JS → Workers Assets)

**Aucun bouton d'exécution** (ingestion/curation) : tout passe par la **passe quotidienne (cron)**. Objectif : pas de déclenchement manuel spammable sur un déploiement public.

Onglets :
- **Deuwi** — liste **lecture seule** des fiches `propose` (triées par score). Carte = Fait, angle, chapitre-tag, profil-badge, flag chiffres, lien source, **liens de référence**, bouton **📋 Copier**. Les fiches déjà sur Notion (`statut=dans_notion`) sont masquées.
- **Dev** — **chips de catégories** (Langages, IA outillage, Web, Cloud, Backend, Sécurité, DevOps, Archi… + ★ Favoris) en filtre principal, statut (retenu/rejeté/tout) en secondaire. Carte = titre-lien, résumé, **liens de référence**, tags catégories, favori ★.
- **Sources** — table des sources (type, flux, rank, actif, dernière passe). Lecture seule.
- **Réglages** — édition de la config (fraîcheur, mots-clés thèse, exclusions, catégories). Enregistrer / Réinitialiser.

**Liens de référence** : chaque item porte `links` (JSON) — URLs extraites du `content:encoded`/`description` du feed (flux dev) et de la page source complète (curation Deuwi). Externes priorisées. Toujours un lien pour creuser.

Format « Copier pour Notion » (presse-papier, texte) :
```
Fait : …
Angle : …
Chapitre : <n> — <label>
Profil : …
Chiffres : OK | À vérifier | Inconnu
Source : <url>
```

---

## 9. Notion — lecture seule (exclusion)

L'app **n'écrit pas** dans Notion. Elle **lit** la base pour exclure les sujets déjà traités (dédup par URL).

- Passe quotidienne : `POST /v1/databases/{id}/query` (paginé), extrait la propriété **`Source`** (URL) de chaque page → `Set` d'URLs normalisées.
- Curation : tout item dont l'URL est dans ce set est **exclu avant scoring** (`items.statut=rejete`, `raison=deja-notion`) → économie de tokens.
- Fiches existantes désormais sur Notion → `drafts.statut=dans_notion` (masquées de la liste).

Seule contrainte côté base Notion : une propriété **`Source`** de type **URL**. Le reste du schéma (Fait, Angle, Chapitre, Profil, Statut, Chiffres, Date) reste à ta main pour le copier-coller, mais n'est pas requis par l'app.

Auth : token d'intégration interne Notion en secret Worker (`NOTION_TOKEN` + `NOTION_DB_ID`). Base à partager avec l'intégration (⋯ → Connections). Sans token, l'app tourne sans exclusion.

---

## 10. Coût & free-tier

- **Ingestion / dedup / filtre** : 0 token, 0 $. Pur code Worker + D1.
- **Haiku** : seulement sur shortlist post-filtre, hors sujets déjà sur Notion (exclus avant scoring). Une passe quotidienne sur ~20-40 items × (score + draft) ≈ quelques centimes.
- **D1 / Workers / Queues / Cron / Pages** : free tier Cloudflare largement suffisant à ce volume.
- Secrets : `ANTHROPIC_API_KEY`, `NOTION_TOKEN` via `wrangler secret put`.

Levier coût principal : la qualité du pré-filtre étage 2. Plus il coupe juste, moins Haiku tourne.

---

## 11. Roadmap

**Phase 1 — socle ingest+lecture (flux `dev` utile tout de suite)**
Worker + D1 + schema + 1-2 sources RSS + dedup + dashboard lecture. Pas de LLM.

**Phase 2 — pipeline `deuwi`**
Étages 2-3-4, prompts Haiku, kanban validation, flags chiffres.

**Phase 3 — Notion sync**
Push validé → Notion, upsert anti-doublon.

**Phase 4 — cron + polish**
Cron hebdo, « run now », affinage regex exclusions, rank sources, WebSearch gaps FR.

---

## 12. À définir avant Phase 1

- Catalogue sources concret : arXiv catégories (cs.SE, cs.AI…), repos GitHub à suivre (releases Claude Code/Cursor/Copilot), feeds FR emploi (APEC, Free-Work, France Travail — RSS existant ? sinon search/scrape), HN/Reddit filtres.
- Fenêtre fraîcheur exacte par flux (`deuwi` 24-48h idéal / hebdo passe ; `dev` plus souple).
- Liste mots-clés pertinence thèse (étage 2.3) affinée.
