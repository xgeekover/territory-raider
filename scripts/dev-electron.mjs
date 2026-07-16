/**
 * Desktop dev runner: Vite dev server (renderer HMR) + esbuild watch
 * (main/preload) + the Electron shell pointed at the dev server URL.
 *
 * Renderer changes hot-reload. Main/preload changes rebuild on disk; restart
 * the process (Ctrl-C, re-run) to pick them up — they change rarely.
 */
import { createServer } from 'vite';
import { context } from 'esbuild';
import { spawn } from 'node:child_process';
import electronPath from 'electron';

const esbuildShared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
};

const ctxMain = await context({
  ...esbuildShared,
  entryPoints: ['electron/main.ts'],
  outfile: 'dist-electron/main.cjs',
});
const ctxPreload = await context({
  ...esbuildShared,
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist-electron/preload.cjs',
});
await Promise.all([ctxMain.rebuild(), ctxPreload.rebuild()]);
await Promise.all([ctxMain.watch(), ctxPreload.watch()]);

const server = await createServer();
await server.listen();
const url =
  server.resolvedUrls?.local?.[0] ??
  `http://localhost:${server.config.server.port ?? 5173}`;
server.printUrls();

let child = null;
let shuttingDown = false;

async function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await ctxMain.dispose();
    await ctxPreload.dispose();
    await server.close();
  } catch {
    /* best-effort */
  }
}

child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});
child.on('close', async () => {
  await cleanup();
  process.exit(0);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    child?.kill();
    await cleanup();
    process.exit(0);
  });
}
