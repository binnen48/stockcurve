# StockCurve

Independent radar for **Pons** memecoin launches on Robinhood Chain (chain ID 4663), filtered by quote asset class: tokenized stocks (RWA), USDG, or ETH/WETH.

Unique niche: RWA-quote discovery + official Safe Links panel. No login. No API keys.

> Kort NL: gratis publieke radar voor Pons-launches, filter op quote-asset. Geen login.

## Features

- Dark SPA (vanilla JS + Vite): All | Stocks | USDG | ETH | Watchlist filters, search, sort
- Client auto-refresh every 90s; NL/EN; watchlist; copy CA; shareable hash; keyboard shortcuts
- Graduation bars, stats strip, deployer counts, PWA manifest
- Public static JSON under /feed/ (no user keys)

## Data files

- `public/feed/launches.json` — launches + quote classification
- `public/feed/quotes.json` — quote registry
- `public/feed/safe-links.json` — official links
- `public/feed/meta.json` — updatedAt + counts

Refresh: `scripts/refresh-data.mjs`

## Local run

```bash
npm install
npm run refresh
npm run dev
npm run build
```

## Deploy

GitHub Actions (`.github/workflows/pages.yml`): install deps, refresh data (~every 15 minutes; sets STOCKCURVE_BASE for Pages), build, deploy Pages from Actions.

## Disclaimer

Independent community tool. Not affiliated with Robinhood, Pons Labs, or FOMO. Not financial advice. Verify every URL.

## Vite base / hosting

Default build base is `/` (independent host). For legacy Pages path set env STOCKCURVE_BASE=/stockcurve/ when building.

## Legacy mirror

Historical GitHub Pages mirror (may lag): https://binnen48.github.io/stockcurve/

