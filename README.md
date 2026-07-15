# Le Signal

Le signal, pas le bruit. Une app de veille qui agrège et filtre l'actu tech en
continu, pré-triée par heuristique avant tout appel LLM, pour ne garder que ce
qui compte.

**En ligne : [signal.deuwi.xyz](https://signal.deuwi.xyz)** · Conception :
[SPEC.md](SPEC.md) · Sources : [SOURCES.md](SOURCES.md)

Cloudflare Workers + Hono + D1 + Cron + Assets. Dashboard vanilla JS (zéro
build). Budget mini (pré-filtre heuristique avant tout appel LLM). Interface
éditoriale « périodique imprimé », **bilingue FR/EN** et **mode clair/sombre**
(préférence système par défaut, choix mémorisé).

## La sélection

Le flux principal (`dev`) : veille perso large, filtrable par **catégories**
(langages, IA outillage, web, cloud, backend, sécu, devops, archi), avec
favoris ★. Chaque entrée a un résumé dépliable et ses liens de référence.

L'idée : ne pas rouvrir dix onglets chaque matin pour se faire une idée de ce
qui bouge. Une passe quotidienne (cron, 07:00 UTC) ingère, dédup, filtre et
catégorise, sans bouton d'exécution public :

```
ingest (RSS/Atom + Hacker News)
  → dédup (hash URL normalisée + titre)
  → pré-filtre heuristique 0 token (fraîcheur · exclusions · pertinence) + catégorisation
```

La config du pré-filtre (fraîcheur, exclusions, mots-clés, catégories) est
**éditable dans l'onglet Réglages** et appliquée à la passe suivante.

## Atelier Deuwi (usage interne)

Un second flux (`deuwi`) sert à ma propre production de contenu : curation
plus sélective, chaque **fiche** associant fait sourcé, angle de post,
chapitre de référence et profil ciblé, en FR et EN. Il alimente directement
mon écriture LinkedIn/TikTok et s'exporte en CSV ou vers Notion. Pas conçu
pour un usage tiers, mais rien n'est caché : le code et la logique sont dans
ce même repo.

### Notion (pour l'Atelier)

- **Lecture (exclusion)** — la passe lit la propriété `Source` (URL) de la
  base pour ne pas reproposer ce qui y est déjà.
- **Écriture (à la demande)** — bouton « Créer dans Notion » sur une fiche →
  crée la page (colonnes Fait / Angle / Chapitre / Profil / Chiffres /
  Source). Protégé par `ADMIN_TOKEN` (voir Sécurité). La copie CSV reste
  dispo en repli.

Contrainte base Notion : une propriété **`Source`** de type **URL**. Partage
la base avec l'intégration (⋯ → Connections) sinon l'API renvoie 404. Sans
token Notion, l'app tourne sans exclusion ni écriture, la partie « La
sélection » n'est pas affectée.

## Prérequis

- Node 20+
- Compte Cloudflare + `wrangler` (`npx wrangler login`)

## Setup local

```bash
npm install
npx wrangler d1 create veille          # colle le database_id dans wrangler.jsonc
npm run db:migrate:local               # schéma + seed sources
npm run dev                            # http://localhost:8787
```

Secrets locaux dans `.dev.vars` (gitignoré, voir
[.dev.vars.example](.dev.vars.example)) : `ANTHROPIC_API_KEY` (curation),
`NOTION_TOKEN` + `NOTION_DB_ID` (Notion), `ADMIN_TOKEN` (protège les
écritures).

Déclencher une passe en dev (l'endpoint est protégé — en-tête
`X-Admin-Token`) :

```bash
curl -X POST "http://localhost:8787/api/daily?force=1" -H "x-admin-token: <ADMIN_TOKEN>"
# → {started:true}, tourne en tâche de fond
```

## Déploiement

```bash
npm run db:migrate                     # migrations sur la base distante
npm run deploy                         # déploie le Worker + assets
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put NOTION_TOKEN
npx wrangler secret put NOTION_DB_ID
npx wrangler secret put ADMIN_TOKEN
```

Cron quotidien (07:00 UTC) et custom domain `signal.deuwi.xyz` configurés
dans [wrangler.jsonc](wrangler.jsonc).

## Sécurité

Repo public. **Aucun secret dans le dépôt.** `.dev.vars` est gitignoré ; voir
[.dev.vars.example](.dev.vars.example). Secrets de prod via `wrangler secret
put`.

### Modèle d'authentification

L'app est déployée **publiquement**. La séparation est simple :

- **Lecture = publique** (aucune auth) : `GET /api/items`, `/api/stats`,
  `/api/sources`, `/api/drafts`, `/api/config`, et le dashboard.
- **Écriture = protégée** par un secret partagé `ADMIN_TOKEN` : toute route
  qui modifie l'état ou dépense des ressources.

| Route                    | Méthode      | Auth | Effet protégé                                             |
| ------------------------ | ------------ | ---- | --------------------------------------------------------- |
| `/api/drafts/:id/notion` | POST         | ✅   | crée une page Notion                                      |
| `/api/config`            | PUT / DELETE | ✅   | modifie/réinitialise les filtres (regex → ReDoS possible) |
| `/api/daily`             | POST         | ✅   | déclenche ingestion + curation Haiku (coût $)             |
| `/api/items/:id/flag`    | POST         | ✅   | écrit en base (lu/favori)                                 |
| lectures + dashboard     | GET          | ❌   | —                                                         |

**Comment ça marche** ([src/auth.ts](src/auth.ts)) :

1. Le client envoie l'en-tête `X-Admin-Token: <valeur>` sur chaque écriture.
2. Le serveur compare à `ADMIN_TOKEN` (secret Worker) en **temps constant**
   (empreintes SHA-256, pas de fuite de longueur).
3. Absent/mauvais → `401`. `ADMIN_TOKEN` non configuré → `503`.

Côté dashboard : la clé est saisie **une fois** (popup), gardée en
`localStorage`, renvoyée sur chaque action d'écriture. Un `401` la purge et
redemande.

`ADMIN_TOKEN` est une chaîne aléatoire **que tu définis** (ex. `openssl rand
-hex 24`) — la même valeur va dans le secret Worker et dans le dashboard ; ce
n'est pas un token fourni par un service. `NOTION_TOKEN` (intégration
Notion, pour écrire les pages) et `ADMIN_TOKEN` (ta clé d'accès aux
écritures) sont **distincts**.

**Défenses complémentaires** : requêtes SQL paramétrées ; `processEntities:false`
sur le parseur XML (pas de XXE) ; bornes sur la config (longueur des motifs,
nb de règles, fraîcheur 1-365) contre le ReDoS ; `safeUrl` côté client
bloque les href `javascript:`/`data:` ; erreurs internes loggées serveur,
message générique au client.

**Non couvert** (à ajouter si besoin) : rate-limiting (règle Cloudflare
recommandée vu l'exposition publique).

## État

- ✅ Ingestion (RSS/Atom + Hacker News), dédup, pré-filtre heuristique 0
  token, catégorisation
- ✅ Curation Deuwi : fetch source + Haiku (score, chapitre, profil, vérif
  chiffres) + draft angle
- ✅ Fiches **bilingues FR/EN** (générées à la curation)
- ✅ Notion : exclusion (lecture) + création de page (écriture protégée) +
  copie CSV
- ✅ Passe quotidienne (cron) + garde-fou 1×/20h
- ✅ Config éditable (Réglages), liens de référence, résumé dépliable
- ✅ Interface « Le Signal » (bilingue, mode clair/sombre) déployée sur
  signal.deuwi.xyz
- ⬜ Sources `search`/`scrape` (Cursor, Free-Work, APEC), France Travail
  (chiffres marché FR)
- ⬜ Rate-limiting, rétro-remplissage EN des fiches antérieures

## Licence

MIT — voir [LICENSE](LICENSE).
