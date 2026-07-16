/**
 * Generate all app icons: PNG master + macOS .icns.
 *
 * 1. Runs Electron (scripts/icon-electron.cjs) to draw build/icon.png (1024)
 *    and the full build/icon.iconset/ at native sizes.
 * 2. On macOS, converts the iconset to build/icon.icns with iconutil.
 *
 * electron-builder picks these up: mac uses icon.icns, win/linux use icon.png
 * (the Windows .ico is derived automatically at package time).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import electronPath from 'electron';

const run = (cmd, args) => {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`✗ ${cmd} ${args.join(' ')} failed (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
};

run(electronPath, ['scripts/icon-electron.cjs']);

if (process.platform === 'darwin') {
  run('iconutil', ['-c', 'icns', 'build/icon.iconset', '-o', 'build/icon.icns']);
  rmSync('build/icon.iconset', { recursive: true, force: true });
  console.log('✓ build/icon.icns generated');
} else if (!existsSync('build/icon.icns')) {
  console.log('(non-macOS: icon.icns not regenerated — commit it from a mac build)');
}
