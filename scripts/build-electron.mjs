/**
 * Compile the Electron main + preload from TypeScript to CommonJS `.cjs`.
 *
 * esbuild gives deterministic control over format/extension that the Vite
 * plugins would not: both outputs are real CommonJS (`require`/`module.exports`)
 * with a `.cjs` extension, so `__dirname` and a *sandboxed* preload work even
 * though package.json is `"type": "module"`. `electron` and Node built-ins stay
 * external — they are provided by the Electron runtime.
 */
import { build } from 'esbuild';

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20', // Electron 43 ships Node 20+
  format: 'cjs',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'info',
};

await Promise.all([
  build({ ...shared, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' }),
  build({ ...shared, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' }),
]);

console.log('✓ electron main/preload built → dist-electron/*.cjs');
