# Veille

App de veille dev + pipeline de curation « Project Deuwi ». Une app, deux flux.
Cloudflare Workers + Hono + D1. Budget mini, semi-assisté.

- **Flux `dev`** — veille perso large (langages, IA outillage, web/cloud, archi).
- **Flux `deuwi`** — curation sélective/vérifiée alimentant le Project Deuwi (livre + LinkedIn).

Conception : [SPEC.md](SPEC.md) · Sources : [SOURCES.md](SOURCES.md).

## État — Phases 1-3

- **Phase 1** — ingestion (RSS/Atom + Hacker News), dédup, pré-filtre heuristique (0 token), dashboard lecture.
- **Phase 2** — pipeline Deuwi : fetch source complète + Haiku (score, chapitre, profil, vérif chiffres) + draft angle, kanban de validation (brouillon/validé/jeté), édition inline.
- **Phase 3** — sync Notion : push des fiches validées vers ta base, upsert anti-doublon (`notion_id`).

Secrets requis (`.dev.vars` local / `wrangler secret put` prod) :
`ANTHROPIC_API_KEY` (Phase 2), `NOTION_TOKEN` + `NOTION_DB_ID` (Phase 3).

### Base Notion — propriétés attendues (noms EXACTS)

Le sync mappe sur ces propriétés ; les noms doivent correspondre sinon l'API renvoie 400 :

| Propriété | Type Notion |
|---|---|
| `Fait` | Title |
| `Angle` | Text |
| `Statut` | Select |
| `Chapitre` | Select |
| `Profil` | Select |
| `Chiffres` | Select |
| `Source` | URL |
| `Date fait` | Date |

Les valeurs de Select absentes sont créées automatiquement par Notion.
Pense à **partager la base avec l'intégration** (⋯ → Connections), sinon 404.

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
2. ✅ Pipeline `deuwi` : fetch source + Haiku (score, chapitre, vérif chiffres) + draft angle + validation
3. ✅ Sync Notion (upsert anti-doublon)
4. Cron polish, sources `search`/`scrape`, France Travail

## Licence

MIT — voir [LICENSE](LICENSE).
