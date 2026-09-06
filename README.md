# StockCurve

**Live:** https://stockcurve.github.io/app/

Org: https://github.com/stockcurve · Source: https://github.com/stockcurve/stockcurve.github.io

Independent radar for **Pons** memecoin launches on Robinhood Chain (chain ID 4663), filtered by quote asset class: tokenized stocks (RWA), USDG, or ETH/WETH.

Unique niche: RWA-quote discovery + Live RPC scanning + official Safe Links panel. No login. No API keys.

## Features

- Dark SPA with Live RPC, quote chips, On-curve toggle, notifications, quote mix bar
- Watchlist, copy CA, one-click Share, shareable hash, keyboard shortcuts 1-5 and slash
- Public static JSON under /feed/

## Data files

- public/feed launches quotes safe-links meta

Refresh: scripts/refresh-data.mjs

## Local run

Use npm scripts: install, refresh, dev, build.

## Deploy

Primary: force-push dist/ to gh-pages on stockcurve/app (`STOCKCURVE_BASE=/app/`).
Browser keeps data fresh: Live RPC + auto-refresh every ~45s (Pons API, or wider RPC log backfill if CORS blocks). No server republish required.
Root stockcurve.github.io Pages is currently locked/errored — do not spam pushes there.

## Disclaimer

Independent community tool. Not affiliated with Robinhood, Pons Labs, or FOMO. Not financial advice.

## Vite base

Canonical: https://stockcurve.github.io/app/ (build with STOCKCURVE_BASE=/app/).
Legacy mirror: https://binnen48.github.io/stockcurve/
