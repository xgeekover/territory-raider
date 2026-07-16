/**
 * Electron entry that renders the app icon on a <canvas> and writes PNGs.
 *
 * The icon is drawn parametrically per size (crisp at 16px and 1024px alike)
 * in the game's own visual language: dark zinc field, faint grid, a claimed
 * cyan region cut by a neon trail, the player diamond, the fuchsia hex boss
 * and a yellow spark. Run via `npm run icon` (scripts/make-icon.mjs).
 */
const { app, BrowserWindow } = require('electron');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const OUT = join(__dirname, '..', 'build');
const ICONSET = join(OUT, 'icon.iconset');

// [filename, pixel size] — macOS iconset naming; icon.png is the 1024 master.
const TARGETS = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

// Serialized into the page: draws one icon at `s` px and returns a data URL.
const DRAW_FN = `
function drawIcon(s) {
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const g = c.getContext('2d');
  const m = s * 0.06, r = s * 0.20;
  const x0 = m, y0 = m, w = s - 2 * m, h = s - 2 * m;

  function rr(x, y, ww, hh, rad) {
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + ww, y, x + ww, y + hh, rad);
    g.arcTo(x + ww, y + hh, x, y + hh, rad);
    g.arcTo(x, y + hh, x, y, rad);
    g.arcTo(x, y, x + ww, y, rad);
    g.closePath();
  }

  // Background: zinc gradient inside a rounded square.
  const bg = g.createLinearGradient(0, y0, 0, y0 + h);
  bg.addColorStop(0, '#26262e');
  bg.addColorStop(0.55, '#131318');
  bg.addColorStop(1, '#09090b');
  rr(x0, y0, w, h, r);
  g.fillStyle = bg; g.fill();

  g.save();
  rr(x0, y0, w, h, r);
  g.clip();

  // Faint cyan grid (invisible at tiny sizes — fine).
  g.strokeStyle = 'rgba(34,211,238,0.07)';
  g.lineWidth = Math.max(1, s * 0.004);
  const step = w / 12;
  for (let i = 1; i < 12; i++) {
    g.beginPath(); g.moveTo(x0 + i * step, y0); g.lineTo(x0 + i * step, y0 + h); g.stroke();
    g.beginPath(); g.moveTo(x0, y0 + i * step); g.lineTo(x0 + w, y0 + i * step); g.stroke();
  }

  // Trail polyline: left edge -> two right-angle cuts -> right edge.
  const P = [[0, .62], [.38, .62], [.38, .34], [.66, .34], [.66, .74], [1, .74]]
    .map(([fx, fy]) => [x0 + fx * w, y0 + fy * h]);

  // Claimed region: everything under the trail glows cyan.
  g.beginPath();
  g.moveTo(P[0][0], P[0][1]);
  for (const [px, py] of P.slice(1)) g.lineTo(px, py);
  g.lineTo(x0 + w, y0 + h);
  g.lineTo(x0, y0 + h);
  g.closePath();
  const cf = g.createLinearGradient(0, y0, 0, y0 + h);
  cf.addColorStop(0, 'rgba(34,211,238,0.30)');
  cf.addColorStop(1, 'rgba(34,211,238,0.10)');
  g.fillStyle = cf; g.fill();

  // Neon trail: glow pass + bright core pass.
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.shadowColor = '#22d3ee'; g.shadowBlur = s * 0.05;
  g.strokeStyle = '#22d3ee'; g.lineWidth = s * 0.036;
  g.beginPath();
  g.moveTo(P[0][0], P[0][1]);
  for (const [px, py] of P.slice(1)) g.lineTo(px, py);
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = '#d8fbff'; g.lineWidth = s * 0.013;
  g.beginPath();
  g.moveTo(P[0][0], P[0][1]);
  for (const [px, py] of P.slice(1)) g.lineTo(px, py);
  g.stroke();

  // Player diamond at the top bend of the cut.
  const [pxx, pyy] = P[3];
  const pr = s * 0.075;
  g.shadowColor = '#22d3ee'; g.shadowBlur = s * 0.06;
  g.fillStyle = '#a5f3fc';
  g.beginPath();
  g.moveTo(pxx, pyy - pr); g.lineTo(pxx + pr, pyy);
  g.lineTo(pxx, pyy + pr); g.lineTo(pxx - pr, pyy);
  g.closePath(); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  const p2 = pr * 0.45;
  g.beginPath();
  g.moveTo(pxx, pyy - p2); g.lineTo(pxx + p2, pyy);
  g.lineTo(pxx, pyy + p2); g.lineTo(pxx - p2, pyy);
  g.closePath(); g.fill();

  // Boss hexagon lurking in the unclaimed dark (top-right).
  const bx = x0 + .80 * w, by = y0 + .17 * h, br = s * 0.09;
  g.shadowColor = '#e879f9'; g.shadowBlur = s * 0.05;
  g.strokeStyle = '#e879f9'; g.fillStyle = '#701a75';
  g.lineWidth = s * 0.016;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const hx = bx + Math.cos(a) * br, hy = by + Math.sin(a) * br;
    i ? g.lineTo(hx, hy) : g.moveTo(hx, hy);
  }
  g.closePath(); g.fill(); g.stroke();
  g.shadowBlur = 0;

  // Spark crawling up the trail.
  g.shadowColor = '#fde047'; g.shadowBlur = s * 0.04;
  g.fillStyle = '#fde047';
  g.beginPath(); g.arc(x0 + .20 * w, y0 + .62 * h, s * 0.026, 0, 7); g.fill();
  g.shadowBlur = 0;

  g.restore();

  // Subtle rim.
  rr(x0, y0, w, h, r);
  g.strokeStyle = 'rgba(148,163,184,0.28)';
  g.lineWidth = Math.max(1, s * 0.006);
  g.stroke();

  return c.toDataURL('image/png');
}
`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('about:blank');

  mkdirSync(ICONSET, { recursive: true });

  const save = async (file, size) => {
    const dataUrl = await win.webContents.executeJavaScript(`(${DRAW_FN.trim()})(${size})`);
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  };

  await save(join(OUT, 'icon.png'), 1024);
  for (const [name, size] of TARGETS) await save(join(ICONSET, name), size);

  console.log('✓ icon PNGs written to build/ (master 1024 + iconset)');
  app.exit(0);
});
