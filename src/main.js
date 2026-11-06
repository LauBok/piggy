const { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage, powerMonitor, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const content = require('./content');

// The installed app is called 小猪桌宠, but saves have always lived in the "piggy" folder:
// keep that name so updates and the dev build share one save.
app.setName('piggy');
content.registerScheme();

const RELEASES_URL = 'https://github.com/LauBok/piggy/releases/latest';

const WIN_W = 280;
const WIN_H = 372;

let win;
let homeWin;
let tray;
let dragTimer = null;

const savePath = () => path.join(app.getPath('userData'), 'save.json');

// The pet window is full size, or just big enough for the face in mini mode
const FULL_SIZE = { w: WIN_W, h: WIN_H };
const MINI_SIZE = { w: 96, h: 84 };
let size = FULL_SIZE;

// setBounds instead of setPosition: on scaled Windows displays setPosition can slowly grow the window
function moveTo(x, y) {
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: size.w, height: size.h });
}

// Switch size around the bottom centre, where the pig stands; returns the new position
ipcMain.handle('win:mini', (_e, on) => {
  const b = win.getBounds();
  size = on ? MINI_SIZE : FULL_SIZE;
  const x = Math.round(b.x + b.width / 2 - size.w / 2);
  const y = Math.round(b.y + b.height - size.h);
  moveTo(x, y);
  return { x, y };
});

ipcMain.handle('screen:display', () => {
  const b = win.getBounds();
  const d = screen.getDisplayNearestPoint({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  return { bounds: d.bounds, workArea: d.workArea };
});

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: workArea.x + workArea.width - WIN_W - 40,
    y: workArea.y + workArea.height - WIN_H,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.webContents.on('did-finish-load', () => content.watchHealth(win, reloadWindows));
  win.loadURL('piggy://app/index.html');
}

function reloadWindows() {
  win.reload();
  if (homeOpen()) homeWin.reload();
}

const homeOpen = () => homeWin && !homeWin.isDestroyed();

// The bigger "home" window with the shop, school, jobs etc. It's only a view: actions are
// forwarded to the pet window, which owns the game state and pushes snapshots back.
function openHome(tab = 'status') {
  if (homeOpen()) {
    homeWin.webContents.send('home:tab', tab);
    homeWin.show();
    homeWin.focus();
    return;
  }
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const w = Math.min(900, workArea.width);
  const h = Math.min(690, workArea.height);
  homeWin = new BrowserWindow({
    width: w,
    height: h,
    x: Math.round(workArea.x + (workArea.width - w) / 2),
    y: Math.round(workArea.y + (workArea.height - h) / 2),
    title: '小猪的小窝',
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-home.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  homeWin.loadURL(`piggy://app/home.html?tab=${encodeURIComponent(tab)}`);
  homeWin.once('ready-to-show', () => homeWin.show());
}

// Pink dot drawn in code so there is no image file to ship
function trayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Math.hypot(x - 7.5, y - 7.5) < 7.5) {
        const i = (y * size + x) * 4;
        buf[i] = 0xc6; // B
        buf[i + 1] = 0xb3; // G
        buf[i + 2] = 0xff; // R
        buf[i + 3] = 0xff; // A
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

// null, or { version, ready } once a newer version is found (ready: downloaded and installable)
let update = null;
// version of downloaded game content waiting to be applied, or null
let contentUpdate = null;

function buildTrayMenu() {
  const items = [
    { label: '显示小猪', click: () => win.show() },
    { label: '打开小窝', click: () => openHome() },
    { label: '迷你模式', click: () => win.webContents.send('pet:act', 'mini') },
  ];
  if (contentUpdate) items.push({ label: `更新内容到 ${contentUpdate}（重新加载）`, click: applyContent });
  if (update?.ready) items.push({ label: `重启并更新到 ${update.version}`, click: () => autoUpdater.quitAndInstall() });
  else if (update) items.push({ label: `下载新版本 ${update.version}`, click: () => shell.openExternal(RELEASES_URL) });
  const v = content.version() === app.getVersion() ? `v${app.getVersion()}` : `v${app.getVersion()} · 内容 v${content.version()}`;
  items.push({ type: 'separator' }, { label: v, enabled: false }, { label: '退出', click: () => app.quit() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function applyContent() {
  if (!content.apply()) return;
  contentUpdate = null;
  buildTrayMenu();
  reloadWindows();
}

// New game content: tell the pet and offer it in the tray (it also applies on the next start)
function contentFound(version) {
  contentUpdate = version;
  buildTrayMenu();
  win.webContents.send('pet:update', { version, content: true });
}

function setupContentUpdates() {
  content.check(contentFound);
  setInterval(() => content.check(contentFound), 6 * 3600 * 1000);
}

// For the 设置 page: versions and what update, if any, is waiting
const updateStatus = () => ({
  packaged: app.isPackaged,
  app: require('../package.json').version,
  content: content.version(),
  contentUpdate,
  update,
});

ipcMain.handle('update:status', () => updateStatus());

ipcMain.handle('update:check', async () => {
  if (app.isPackaged) await autoUpdater.checkForUpdates().catch(() => {});
  await content.check(contentFound);
  return updateStatus();
});

// Applies whatever is waiting: new content reloads the windows, a downloaded app update
// installs and restarts, and on Mac a new app version opens the download page
ipcMain.handle('update:apply', () => {
  if (contentUpdate) applyContent();
  else if (update?.ready) autoUpdater.quitAndInstall();
  else if (update) shell.openExternal(RELEASES_URL);
  return updateStatus();
});

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('小猪桌宠');
  buildTrayMenu();
}

// Checks GitHub Releases on start and every few hours. Windows downloads and installs on the
// next restart. Mac builds aren't code-signed, which Mac auto-install requires, so there the
// pig just tells you and the tray links to the download page.
function setupUpdates() {
  if (!app.isPackaged) return;
  const canInstall = process.platform !== 'darwin';
  autoUpdater.autoDownload = canInstall;
  const tell = (ready, version) => {
    update = { version, ready };
    buildTrayMenu();
    win.webContents.send('pet:update', update);
  };
  autoUpdater.on('update-available', (info) => {
    if (canInstall) update = { version: info.version, ready: false, downloading: true };
    else tell(false, info.version);
  });
  autoUpdater.on('update-downloaded', (info) => tell(true, info.version));
  autoUpdater.on('error', (err) => console.log('update check failed:', err?.message));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 6 * 3600 * 1000);
}

ipcMain.handle('save:load', () => {
  try {
    return JSON.parse(fs.readFileSync(savePath(), 'utf8'));
  } catch {
    return null;
  }
});

// Synchronous so the last save still lands while the window is closing
ipcMain.on('save:write', (e, data) => {
  fs.writeFileSync(savePath(), JSON.stringify(data, null, 2));
  e.returnValue = true;
});

ipcMain.handle('win:getBounds', () => win.getBounds());

ipcMain.handle('screen:workArea', () => {
  const b = win.getBounds();
  return screen.getDisplayNearestPoint({ x: b.x + b.width / 2, y: b.y + b.height / 2 }).workArea;
});

ipcMain.handle('screen:cursor', () => screen.getCursorScreenPoint());

// Seconds since the last keyboard or mouse input anywhere on the computer
ipcMain.handle('sys:idle', () => powerMonitor.getSystemIdleTime());

ipcMain.on('win:setPos', (_e, x, y) => moveTo(x, y));

// Let clicks pass through transparent areas; renderer toggles this as the mouse moves
ipcMain.on('win:ignoreMouse', (_e, ignore) => {
  win.setIgnoreMouseEvents(ignore, { forward: true });
});

// Dragging is tracked here with the real cursor position, which stays smooth even when
// the mouse moves faster than the window can follow
ipcMain.on('drag:start', () => {
  const c = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  const ox = c.x - wx;
  const oy = c.y - wy;
  clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    const p = screen.getCursorScreenPoint();
    moveTo(p.x - ox, p.y - oy);
  }, 16);
});

ipcMain.handle('drag:end', () => {
  clearInterval(dragTimer);
  dragTimer = null;
  const [x, y] = win.getPosition();
  return { x, y };
});

ipcMain.on('home:open', (_e, tab) => openHome(tab));
ipcMain.on('home:act', (_e, action, id) => win.webContents.send('pet:act', action, id));
ipcMain.on('home:ready', () => win.webContents.send('pet:pushState'));
ipcMain.on('home:min', () => homeOpen() && homeWin.minimize());
ipcMain.on('home:close', () => homeOpen() && homeWin.close());
ipcMain.on('pet:state', (_e, snap) => homeOpen() && homeWin.webContents.send('home:state', snap));
ipcMain.on('pet:toast', (_e, t) => homeOpen() && homeWin.webContents.send('home:toast', t));

ipcMain.on('app:quit', () => app.quit());

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock.hide();
    content.serve();
    createWindow();
    createTray();
    setupUpdates();
    setupContentUpdates();
  });
  app.on('second-instance', () => win && win.show());
  app.on('window-all-closed', () => app.quit());
}
