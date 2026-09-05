import { defineConfig } from 'vite';

export default defineConfig({
  base: '/stockcurve/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
