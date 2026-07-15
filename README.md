# Veille

App de veille dev + pipeline de curation « Project Deuwi ». Une app, deux flux.
Cloudflare Workers + Hono + D1. Budget mini, semi-assisté.

- **Flux `dev`** — veille perso large (langages, IA outillage, web/cloud, archi).
- **Flux `deuwi`** — curation sélective/vérifiée alimentant le Project Deuwi (livre + LinkedIn).

Conception : [SPEC.md](SPEC.md) · Sources : [SOURCES.md](SOURCES.md).

## Fonctionnement

**Une passe quotidienne automatique** (cron) fait tout : ingestion → lecture Notion → curation Haiku → exclusion de ce qui est déjà sur Notion. Aucun bouton d'exécution (anti-spam). L'app est une **source de propositions** ; tu copies-colles toi-même dans Notion.

- **Flux `dev`** — liste de lecture filtrable par **catégories** (langages, IA outillage, web, cloud, backend, sécu, devops, archi) + favoris ★. Liens de référence sur chaque carte.
- **Flux `deuwi`** — fiches proposées (fait + angle + chapitre + profil + flag chiffres + liens de référence). Bouton **📋 Copier** par fiche. Ce qui est déjà dans ta base Notion est exclu automatiquement (dédup par URL).
- **Réglages** — fraîcheur, mots-clés thèse, exclusions et catégories entièrement éditables (appliqués à la passe suivante).

### Étapes

- **Phase 1** — ingestion (RSS/Atom + Hacker News), dédup, pré-filtre heuristique (0 token).
- **Phase 2** — curation Deuwi : fetch source complète + Haiku (score, chapitre, profil, vérif chiffres) + draft angle.
- **Phase 3** — Notion en **lecture seule** : exclusion des sujets déjà présents. L'app n'écrit pas dans Notion.

Secrets (`.dev.vars` local / `wrangler secret put` prod) :
`ANTHROPIC_API_KEY` (curation), `NOTION_TOKEN` + `NOTION_DB_ID` (exclusion — optionnel).

### Base Notion — exclusion

Pour que la dédup fonctionne, ta base doit avoir une propriété **`Source`** de type **URL** (l'app y lit les URLs déjà traitées). Partage la base avec l'intégration (⋯ → Connections) sinon l'API renvoie 404. Sans token Notion, l'app tourne quand même (aucune exclusion).

### Déclencher la passe manuellement (dev)

```bash
curl -X POST "http://localhost:8787/api/daily?force=1"   # répond {started:true}, tourne en fond
```
En prod c'est le cron quotidien (07:00 UTC) qui s'en charge.

## Prérequis

- Node 20+
- Compte Cloudflare + `wrangler` (login via `npx wrangler login`)

## Setup local

```bash
npm install

# créer la base D1 puis coller l'id retourné dans wrangler.jsonc (database_id)
npx wrangler d1 create veille

# schéma + seed sources
npm run db:migrate:local
npm run db:seed:local

# lancer
npm run dev
```

Dashboard sur `http://localhost:8787`. Bouton **↻ Run** = passe d'ingestion manuelle.

## Déploiement

```bash
npm run db:migrate      # migrations sur la base distante
npm run db:seed
npm run deploy
```

Cron hebdo (lundi 07:00 UTC) configuré dans [wrangler.jsonc](wrangler.jsonc).

## Sécurité

Repo public. **Aucun secret dans le dépôt.** `.dev.vars` est gitignoré ;
voir [.dev.vars.example](.dev.vars.example). Secrets de prod via `wrangler secret put`.

## Roadmap

1. ✅ Socle ingest + dédup + filtre + dashboard lecture
2. ✅ Pipeline `deuwi` : fetch source + Haiku (score, chapitre, vérif chiffres) + draft angle
3. ✅ Notion en lecture (exclusion des sujets déjà traités) + copier-coller manuel
4. ✅ Passe quotidienne unique (cron) + garde-fou anti-spam
5. Sources `search`/`scrape` (Cursor/Free-Work/APEC), France Travail, déploiement Cloudflare

## Licence

MIT — voir [LICENSE](LICENSE).
