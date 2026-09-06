# Deploy notes

Primary path: https://stockcurve.github.io/app/ via stockcurve/app gh-pages (Vite base `/app/`)

Legacy mirror URL: https://binnen48.github.io/stockcurve/

## Current

- Site is published from the `gh-pages` branch on **stockcurve/app** (Vite base `/app/`)
- `main` holds the Vite app and seeded `public/feed/*.json` (bootstrap cache only)
- Browser keeps list current: Live RPC + auto-refresh ~45s (Pons API or RPC backfill). No Grok Bot routine.


## Manual build

Build with base /app/ then publish dist to app gh-pages.

Optional bootstrap JSON seed script available.

## Cadence

Live mode default ON plus browser auto-update about every 45s. Static feed JSON is bootstrap cache only.
