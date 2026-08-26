# EVE Industry Organizer

A frontend-only React app for EVE Online industry planning: blueprint profit rankings and supply chains.

## Features

- **Top Blueprints**: static rankings from bundled market data (no fetch on list load), budget slider, tier filters, ISK/hr sort, live haul route danger
- **Production graph**: click a blueprint row to open a supply-chain graph modal (`@xyflow/react`); click nodes to open item detail
- **Item detail**: instant metadata from SDE types, live sell price and full market history from ESI
- **Settings**: global defaults and character skills for buildability checks (no EVE login)
- **Layered API caching**: TanStack Query + localStorage TTL + request throttling

## Stack

React · TypeScript · Vite · Tailwind CSS · DaisyUI · TanStack Query/Virtual · Zustand · @xyflow/react

## Setup

```bash
pnpm install
pnpm run dev
```

## Build & deploy (GitHub Pages)

Pushes to `main` deploy automatically via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). To redeploy without a push: **Actions → Deploy to GitHub Pages → Run workflow** (always builds from `main`).

One-time setup in the repo on GitHub:

1. **Settings → Pages → Build and deployment → Source:** GitHub Actions
2. After the first successful run, the site is at  
   https://eve-organizer.github.io/EVE-Industry-Organizer/

Local production preview (same base path as Pages):

```bash
VITE_BASE=/EVE-Industry-Organizer/ pnpm run build
pnpm run preview
```

For local dev, `pnpm run dev` uses relative asset paths (`base: './'`).

## Fetch SDE and market data

```bash
pnpm run fetch-data
```

Downloads the latest [Fuzzwork SDE CSV dump](https://www.fuzzwork.co.uk/dump/latest/csv/), builds `blueprints.json`, full `types.json`, `regions.json`, and `market.json` (prices, per-product history summaries, courier haul rates). History fetch skips products already cached within 24h and writes `market.json` after each batch of 100 fetches.

Refresh prices and market summaries without re-downloading SDE. Reuses history cached in `market.json` for 24h; writes the file after each batch so a interrupted run keeps progress. Progress is shown as a task tree with per-hub phases and ETA during history fetch.

```bash
pnpm run rebuild-market
pnpm run rebuild-market:hub jita          # one hub only (jita, amarr, dodixie, rens, hek)
pnpm run rebuild-market:hub jita,amarr    # multiple hubs
MARKET_HUB=hek pnpm run rebuild-market    # env alternative
```

Faster variants (history is the slow part on first run):

```bash
pnpm run rebuild-market:fast   # prices + haul rates only (~1 min)
pnpm run rebuild-market:dev    # cap history at 500 products per hub
MARKET_HISTORY_CONCURRENCY=20 pnpm run rebuild-market   # parallel ESI (default 10)
MARKET_HISTORY_TTL_HOURS=48 pnpm run rebuild-market     # keep history cache longer
```

## Data sources

| Data | Source |
|---|---|
| Blueprint recipes, types, regions, skills, stations | Bundled JSON in `public/data/` |
| Rankings on Blueprints page | Client-side join of `blueprints.json` + `market.json` + user settings |
| Haul route danger | Live ESI `system_kills` + `route` (cached, ~3 calls per hub/region change) |
| Item detail price & history | Live ESI / Fuzzwork on `/item/:typeId` only |
| Character settings & progress | Manual entry · localStorage |

## License

Apache 2.0. See [LICENSE](LICENSE)
