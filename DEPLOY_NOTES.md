# Deploy notes

Live URL: https://binnen48.github.io/stockcurve/

## Current

- Site is published from the `gh-pages` branch (legacy Pages source).
- `main` holds the Vite app, `scripts/refresh-data.mjs`, and seeded `public/data/*.json`.

## Switching to Actions → Pages

1. Copy `ops/pages.workflow.yml` → `.github/workflows/pages.yml` using a credential that includes the GitHub `workflow` OAuth scope (or create the file in the GitHub web UI).
2. In repo Settings → Pages, set source to **GitHub Actions**.
3. The workflow refreshes Pons launch data about every 15 minutes, builds, and deploys.

## Manual refresh + republish (no Actions)

```bash
npm install
npm run refresh
npm run build
# then publish dist/ to the gh-pages branch
```
