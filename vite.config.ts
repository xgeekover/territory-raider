/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Renderer config only. It stays a pure web build — the Electron main/preload
// are compiled separately by scripts/build-electron.mjs (esbuild), so `npm run
// dev`/`build` behave exactly as before the desktop work.
//
// `base: './'` makes asset URLs relative so the packaged app loads over file://.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
