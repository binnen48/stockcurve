# StockCurve

**Live:** https://binnen48.github.io/stockcurve/

Radar for Pons memecoin launches on Robinhood Chain (chain ID 4663), filtered by quote asset class: tokenized stocks (RWA), USDG, or ETH/WETH.

Unique niche: RWA-quote discovery + official Safe Links panel.

> Kort NL: gratis publieke radar voor Pons-launches, filter op quote-asset. Geen login.

## Features

- Dark SPA (Vite): All | Stocks | USDG | ETH filters, search, sort
- Public static JSON under `/data/` (no user keys)
- Safe Links: ponsfamily.com, robinhood.com/us/en/chain/, robinhoodchain.blockscout.com, FOMO App Store
- Disclaimer: not affiliated with Robinhood / Pons Labs / FOMO; not financial advice

## Data files

- `public/data/launches.json` — launches + quote classification
- `public/data/quotes.json` — quote registry
- `public/data/safe-links.json` — official links
- `public/data/meta.json` — updatedAt + counts

Refresh: `scripts/refresh-data.mjs`

## Local run

```bash
npm install
npm run refresh
npm run dev
npm run build
```

## Deploy

GitHub Actions (`.github/workflows/pages.yml`): install deps, refresh data (about every 15 minutes), build, deploy Pages from Actions.

## Disclaimer

Independent community tool. Not affiliated with Robinhood, Pons Labs, or FOMO. Not financial advice. Verify every URL.
