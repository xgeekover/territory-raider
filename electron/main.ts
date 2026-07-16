/**
 * Electron main process — owns the app lifecycle, the single game window,
 * security hardening, and the high-score IPC handlers.
 *
 * Built to CommonJS (`dist-electron/main.cjs`) so `__dirname` and a sandboxed
 * preload work regardless of the package's `"type": "module"`.
 */
import { app, BrowserWindow, ipcMain, Menu, shell, session } from 'electron';
import { join } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { readHighScore, writeHighScore, sanitizeScore } from './store';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = !!DEV_SERVER_URL;

// Default content area: 768x576 canvas + HUD + padding. The window is freely
// resizable — the renderer scales the whole play field to fit (useFitScale).
const CONTENT_WIDTH = 820;
const CONTENT_HEIGHT = 760;
const MIN_WIDTH = 560;
const MIN_HEIGHT = 500;

/** userData/highscore.json — resolved lazily so tests never touch Electron. */
function scoreFile(): string {
  return join(app.getPath('userData'), 'highscore.json');
}

let mainWindow: BrowserWindow | null = null;

/** Dev-run icon (packaged builds get theirs from the bundle/installer). */
const devIconPng = join(__dirname, '../build/icon.png');

function createWindow(): void {
  mainWindow = new BrowserWindow({
    ...(existsSync(devIconPng) ? { icon: devIconPng } : {}),
    width: CONTENT_WIDTH,
    height: CONTENT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    useContentSize: true,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    backgroundColor: '#09090b', // zinc-950 — no white flash before paint
    title: 'Territory Raider',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  // Reveal only once painted to avoid a blank/flash frame.
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Lock down navigation: no in-app navigations, external links open in the OS browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  // CI/smoke hook: boot the app, confirm the renderer loads, then exit.
  // Exit 0 = booted and rendered; non-zero/hang = failure.
  // With SMOKE_SHOT=<path>, also captures a screenshot before exiting.
  if (process.env.SMOKE_TEST) {
    const failsafe = setTimeout(() => {
      console.error('SMOKE_TEST: renderer did not load within 15s');
      app.exit(1);
    }, 15_000);
    mainWindow.webContents.once('did-finish-load', () => {
      clearTimeout(failsafe);
      const shot = process.env.SMOKE_SHOT;
      if (shot && mainWindow) {
        // Give the first frames a moment to paint before capturing.
        setTimeout(() => {
          mainWindow?.webContents
            .capturePage()
            .then((img) => {
              writeFileSync(shot, img.toPNG());
              console.log(`SMOKE_TEST: renderer loaded OK, screenshot → ${shot}`);
              app.exit(0);
            })
            .catch(() => app.exit(1));
        }, 1200);
        return;
      }
      console.log('SMOKE_TEST: renderer loaded OK');
      app.exit(0);
    });
    mainWindow.webContents.once('did-fail-load', (_e, code, desc) => {
      clearTimeout(failsafe);
      console.error(`SMOKE_TEST: renderer failed to load (${code}): ${desc}`);
      app.exit(1);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/** Deny every renderer permission request — the game needs none (camera, mic, geo, notifications…). */
function hardenSession(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}

/** Strict Content-Security-Policy for the packaged app (dev relies on Vite/HMR). */
function applyCsp(): void {
  if (isDev) return;
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " + // Tailwind injects inline styles
            "img-src 'self' data:; " +
            "font-src 'self'; " +
            "connect-src 'self'; " +
            "object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        ],
      },
    });
  });
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: 'Game',
      submenu: [
        { role: 'togglefullscreen' as const },
        ...(isDev ? [{ role: 'reload' as const }, { role: 'toggleDevTools' as const }] : []),
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc(): void {
  ipcMain.handle('highscore:get', () => readHighScore(scoreFile()));
  ipcMain.handle('highscore:set', (_event, score: unknown) =>
    writeHighScore(scoreFile(), sanitizeScore(score)),
  );
}

// Single-instance: focus the existing window instead of opening a second one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (isDev && process.platform === 'darwin' && existsSync(devIconPng)) {
      app.dock?.setIcon(devIconPng); // packaged .app uses icon.icns from the bundle
    }
    registerIpc();
    hardenSession();
    applyCsp();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
