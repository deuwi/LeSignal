# CHANGELOG — Le Signal

> **Le cadrage de ce projet vient de moi (Rémi Derathé).**
>
> Ce fichier trace les décisions structurantes de « Le Signal ». Elles sont les
> miennes : périmètre, thèse, sources, sécurité, charte, arbitrages. L'assistant
> (Claude, Opus 4.8) **exécute une fois le cadrage posé** — il code, corrige,
> vérifie, mais ne décide pas de la direction.
>
> Le document distingue explicitement **mes décisions** (§1) des **choix
> d'implémentation** que l'assistant a faits seul face à un bug ou une contrainte
> technique (§2). Les raisons rapportées sont celles que j'ai données au moment
> de la consigne ; quand je ne l'ai pas explicitée, c'est marqué
> « raison non précisée » — rien n'est inventé.
>
> Chronologie indicative : cadrage et Phases 1→4 le **2026-07-15**, charte
> « Le Signal », France Travail, Brave et audits le **2026-07-16**.

---

## 1. Mes décisions (cadrage humain)

### 1.1 Fondations — brief initial « BRIQUE VEILLE »

- **Deux flux dans une seule app** : `dev` (veille perso large) + `deuwi`
  (curation pour le Project Deuwi, livre + LinkedIn). — _Raison : deux besoins,
  une infra partagée._
- **Thèse directrice** (fil rouge du flux `deuwi`) :
  « L'IA ne prendra pas ton job. Quelqu'un qui la dirige mieux que toi, si.
  Sans hype, sans déni. » — _Raison : ligne éditoriale du projet._
- **4 profils cible** : junior, confirmé, reconverti, freelance. — _Raison non
  précisée (posé comme donnée du brief)._
- **Modèle semi-assisté** : l'app propose, l'humain tranche. — _Raison non
  précisée._
- **Budget LLM minimal** : Haiku + pré-filtre heuristique 0 token avant tout
  appel modèle. — _Raison : coût._
- **Notion comme sortie** du flux de curation. — _Raison non précisée._
- **Stack Cloudflare** (Workers + Hono + D1 + Cron + Assets). — _Raison non
  précisée (imposée au cadrage)._
- **Règles « BRIQUE »** : fetch obligatoire de la source complète avant d'écrire ;
  pas de `LIMIT` artificiel (c'est la pertinence qui filtre, pas un quota) ;
  l'appartenance à un chapitre n'est pas un critère de rejet. — _Raison : posées
  comme règles dans le brief._

### 1.2 Repo & process

- **Repo public sur mon GitHub.** — _Raison : intention affichée dès le départ.
  Conséquence imposée : aucun secret dans le dépôt._
- **Committer régulièrement pour garder des traces.** — _Raison explicite :
  « si un jour je veux le documenter »._
- **Ce `CHANGELOG.md` est géré à la main.** L'assistant ne le commite ni ne le
  pousse jamais de lui-même (fichier gitignoré côté dépôt) ; c'est moi qui décide
  quand il part sur l'origin. — _Raison : garder le contrôle éditorial de la trace
  de cadrage._

### 1.3 Onglet Dev — filtres & lecture

- **Filtrage par catégories dev** plutôt qu'un filtre d'exclusion en amont. —
  _Raison explicite : « plutôt qu'un filtre apple en amont… les filtres doivent
  proposer tout un tas de catégories associées au dev »._
- **Réglages entièrement éditables** (fraîcheur, mots-clés thèse, exclusions,
  catégories). — _Raison explicite : choix « éditable » quand la question m'a été
  posée._
- **Chaque article porte ses liens de référence.** — _Raison explicite : choix
  « Source + liens extraits »._

### 1.4 Export Notion & sécurité des écritures

- **Copie au format tabulaire** (colonnes Notion), puis **passage au CSV et
  retrait du bouton d'export**. — _Raison non précisée (mapping colonnes visé)._
- **Sécuriser les écritures parce que l'app est publique** ; choix d'un **token
  secret** (après comparaison IP vs token que j'ai tranchée). — _Raison
  explicite : « l'appli est public »._
- **Vérifier avant d'avancer** (« attend on confirme que ça marche »). — _Raison :
  ne pas empiler sans validation._

### 1.5 Passe automatique & modèle read-only

- **Pivot vers une source de propositions en lecture seule** : suppression du
  kanban valider / jeter / éditer / push ; Notion devient référentiel
  d'exclusion. — _Raison non précisée (décision de simplification)._
- **Passe quotidienne automatique (cron 07:00 UTC)**, plus aucun bouton
  d'exécution public. — _Raison non précisée._

### 1.6 Infra & audits

- **Rate-limiting WAF Cloudflare** : règle que j'ai créée et activée moi-même. —
  _Raison non précisée (app publique)._
- **Custom domain sur `deuwi.xyz`.** — _Raison explicite : « j'ai le domaine
  deuwi.xyz autant l'utiliser »._
- **Audit de sécurité complet.** — _Raison non précisée._
- **Documenter le modèle d'authentification dans le README.** — _Raison non
  précisée._

### 1.7 Charte « Le Signal »

- **Reskin éditorial « Le Signal » + interface bilingue FR/EN** (spec détaillée
  fournie par moi). — _Raison : directive de design._
- **Déplacer Sources et Réglages de la nav vers le pied de page.** — _Raison non
  précisée._
- **Résumé dépliable en place.** — _Raison explicite : « sans avoir à aller sur un
  autre site »._
- **Traduire aussi les posts** (fiches Atelier bilingues). — _Raison : le toggle
  FR/EN ne traduisait pas les posts._
- **Traduire aussi les titres/résumés de « La sélection »** (items dev, FR + EN) :
  décision de livrer la traduction des items (feature restée en WIP local). —
  _Raison : le toggle FR/EN ne touchait pas les titres d'articles, qui restaient en
  langue source._
- **Mode clair/sombre.** — _Raison non précisée (« détail esthétique »)._
- **Corriger les affirmations invérifiables** de l'encadré « le bruit qu'on a
  coupé ». — _Raison : exactitude (j'ai questionné la véracité de l'affirmation)._

### 1.8 Corrections texte ciblées & renommage domaine

- **Trois corrections précises** : meta tags, thèse canonique, vrai lien LinkedIn,
  avec la consigne « ne touche à aucun autre » et « confirme-moi les fichiers
  modifiés avant de committer ». — _Raison : contrôle du périmètre._
- **Renommer le domaine public en `signal.deuwi.xyz`** (retirer l'ancien). —
  _Raison explicite : cohérence avec le nom « Le Signal »._

### 1.9 France Travail & Brave

- **Intégrer France Travail** : données Offres + Marché du travail + ROME. —
  _Raison non précisée (API souscrites de mon côté)._
- **« On évite le code hard codé »** : codes ROME et territoire en config
  éditable, pas figés dans le code. — _Raison : directive explicite._
- **Activer les sources de recherche Brave** (clé fournie par moi). — _Raison non
  précisée._

### 1.10 Véracité de la documentation

- **Contrôler la véracité du README** (un autre assistant avait fabulé) ; j'ai
  moi-même repéré « en continu », puis la redondance et l'omission de
  Codex. — _Raison explicite : « l'autre chat a fabuler »._
- **Contrôler la véracité de tous les `.md` puis tout aligner sur le réel.** —
  _Raison : audit demandé ; choix « tout aligner » quand la question m'a été
  posée._

### 1.11 Rétention / purge

- **Purger automatiquement les sujets datant de plus d'une semaine** (rétention
  7 jours), au lieu de la conservation infinie actuelle. — _Raison : éviter
  l'accumulation illimitée en base ; la veille ne garde que le frais._
- _État : livrée._ `src/purge.ts` (purge par `cree_le`, fenêtre `RETENTION_DAYS`
  = 7 j) câblée dans la passe quotidienne, déployée. Impact prod à ce jour : 0
  (aucun item n'a encore 7 jours ; mordra quand ils vieilliront).

### 1.12 Vue « La sélection » — regroupement par catégorie

- **Regrouper les articles de « La sélection » en sections repliables par
  catégorie** (au lieu du tri à plat par rang de source), tri par date dans chaque
  section, les chips de catégories existantes servant d'ancres/filtre. Règle : une
  **catégorie primaire** par item (pas de doublon entre sections), bucket
  « Autres » pour les non catégorisés. — _Raison : confort de lecture / scan
  d'ensemble ; le tri par source ne regroupe le sujet que par accident._
- _État : décidé, à implémenter (côté `public/app.js` surtout ; le back renvoie
  déjà `items.categories`)._

---

## 2. Exécution — choix d'implémentation de l'assistant

Décisions techniques prises par l'assistant seul, sans consigne de ma part,
généralement en réaction à un bug ou une limite de plateforme. Elles servent le
cadrage ci-dessus, elles ne le définissent pas.

- **`processEntities:false`** sur le parseur XML — les gros feeds dépassaient le
  plafond de 1000 entités.
- **Seed idempotent FK-safe** (`INSERT OR REPLACE`, ids explicites) — après une
  violation de clé étrangère au reseed.
- **Inserts D1 groupés par lots de 50** (`env.DB.batch`) — limite ~1000
  sous-requêtes par invocation Worker (invisible en local, bloquant en prod).
- **Passe fire-and-forget** (`waitUntil`) + **garde-fou 1×/20h** via `app_state`.
- **Comparaison de token à temps constant** (empreintes SHA-256), `requireAdmin`
  asynchrone.
- **Host OAuth France Travail `entreprise.pole-emploi.fr`** — `entreprise.
francetravail.io` ne résout pas (NXDOMAIN).
- **Scope stats `api_stats-offres-demandes-emploiv1 offresetdemandesemploi`**
  (extrait du securityScheme OpenAPI) et **parsing de la synthèse `PERSPECTIVE`**
  de l'indicateur PERSP_2 ; **territoire national NAT/FR par défaut**.
- **Génération FR + EN dans le même appel Haiku** (le principe bilingue vient de
  moi ; le « comment » est de l'assistant).
- **Traduction des items découplée de la passe quotidienne** : la limite ~50
  sous-requêtes/invocation Worker tuait la traduction (jamais atteinte après le
  curate). Sortie sur son propre cron (09:00 UTC) + endpoint `POST /api/translate`,
  plafond 45/invocation.
- **Purge basée sur `cree_le`** (et non `date_pub`) — format uniforme, fiable en
  SQL contrairement aux dates de feeds hétérogènes ; suppression FK-safe
  (drafts/verdicts avant items).
- **Bascule rate-limit** binding natif Workers → règle WAF (le binding natif
  était sans effet) — j'ai créé la règle, le diagnostic et la bascule sont de
  l'assistant.
- **Jeu de catégories précis** (Langages, IA outillage, Web, Cloud, Backend,
  Sécurité, DevOps, Archi) — j'ai demandé « catégories associées au dev », la
  liste exacte est de l'assistant.
- **Itérations de format de copie** (texte → `<table>` HTML → TSV → CSV) —
  dictées par le comportement de Notion (le choix final CSV est le mien).
- **Cadence mensuelle France Travail** (`ranWithin("ft", 25 j)`) — choix de
  fréquence de l'assistant.

---

_Fichier tenu comme trace du cadrage humain. Toute nouvelle décision structurante
s'ajoute en §1 ; toute nouvelle solution technique non dictée, en §2._
