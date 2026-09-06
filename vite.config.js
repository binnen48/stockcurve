import { defineConfig } from 'vite';

/** Base path: STOCKCURVE_BASE=/ for independent host; /stockcurve/ for legacy GitHub Pages. */
const raw = process.env.STOCKCURVE_BASE ?? '/';
const base = raw.endsWith('/') ? raw : `${raw}/`;

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
