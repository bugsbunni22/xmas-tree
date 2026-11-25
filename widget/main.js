// 크리스마스 트리 위젯 — 모니터 구석에 항상 떠 있는 투명 창
const { app, BrowserWindow, Tray, Menu, shell, screen, nativeImage, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const CONFIG_FILE = () => path.join(app.getPath("userData"), "config.json");
const SIZES = { S: [170, 223], M: [230, 302], L: [300, 393] };
const DEFAULTS = { siteUrl: "", corner: "bottom-right", size: "M", snow: true, x: null, y: null, autoStart: false };
let cfg = { ...DEFAULTS };
let win = null, setupWin = null, tray = null, moveMode = false, moveCssKey = null, clickThrough = true;

function loadCfg() {
  try { cfg = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE(), "utf8")) }; } catch { cfg = { ...DEFAULTS }; }
  // 같은 폴더에 config.json이 있으면 처음 한 번 그 주소를 씀 (배포용)
  if (!cfg.siteUrl) {
    try {
      const local = JSON.parse(fs.readFileSync(path.join(path.dirname(process.execPath), "config.json"), "utf8"));
      if (local.siteUrl) cfg.siteUrl = local.siteUrl;
    } catch {}
  }
}
function saveCfg() {
  try { fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true }); fs.writeFileSync(CONFIG_FILE(), JSON.stringify(cfg, null, 2)); } catch (e) { console.error(e); }
}

function widgetUrl() {
  const u = new URL(cfg.siteUrl);
  u.searchParams.set("widget", "1");
  if (!cfg.snow) u.searchParams.set("snow", "0");
  return u.toString();
}

function cornerPos(w, h) {
  const area = screen.getPrimaryDisplay().workArea, m = 8;
  const right = area.x + area.width - w - m, bottom = area.y + area.height - h - m;
  switch (cfg.corner) {
    case "top-left": return [area.x + m, area.y + m];
    case "top-right": return [right, area.y + m];
    case "bottom-left": return [area.x + m, bottom];
    default: return [right, bottom];
  }
}
function onSomeScreen(x, y, w, h) {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return x + w / 2 >= a.x && x + w / 2 <= a.x + a.width && y + h / 2 >= a.y && y + h / 2 <= a.y + a.height;
  });
}
function placeWin() {
  const [w, h] = SIZES[cfg.size] || SIZES.M;
  let x = cfg.x, y = cfg.y;
  if (cfg.corner !== "custom" || x == null || !onSomeScreen(x, y, w, h)) [x, y] = cornerPos(w, h);
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h });
}

function createWidget() {
  const [w, h] = SIZES[cfg.size] || SIZES.M;
  win = new BrowserWindow({
    width: w, height: h, transparent: true, frame: false, resizable: false, maximizable: false,
    minimizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false,
    backgroundColor: "#00000000", show: false, title: "크리스마스 트리",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true }
  });
  win.setAlwaysOnTop(true, "screen-saver");
  placeWin();
  win.setIgnoreMouseEvents(true, { forward: true });

  // 트리를 누르면 열리는 링크 → 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.includes("widget=1")) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  win.webContents.on("did-fail-load", (_e, code) => {
    if (code === -3) return; // 취소됨
    setTimeout(() => win && !win.isDestroyed() && win.loadURL(widgetUrl()), 30000);
  });
  win.once("ready-to-show", () => win.showInactive());
  win.on("moved", () => {
    if (!moveMode) return;
    const b = win.getBounds();
    cfg.corner = "custom"; cfg.x = b.x; cfg.y = b.y; saveCfg(); buildMenu();
  });
  win.loadURL(widgetUrl());
}

// 투명한 빈 곳은 클릭이 뒤로 통과, 트리 위에서만 클릭됨
ipcMain.on("tree:solid", (_e, solid) => {
  if (!win || moveMode) return;
  const want = !solid;
  if (want !== clickThrough) { clickThrough = want; win.setIgnoreMouseEvents(want, { forward: true }); }
});

async function setMoveMode(on) {
  moveMode = on;
  if (!win) return;
  if (on) {
    win.setIgnoreMouseEvents(false);
    moveCssKey = await win.webContents.insertCSS("html{outline:3px dashed rgba(255,255,255,.9);outline-offset:-3px;background:rgba(0,0,0,.25)!important}body,body *{-webkit-app-region:drag!important;cursor:move!important}");
  } else {
    if (moveCssKey) { await win.webContents.removeInsertedCSS(moveCssKey).catch(() => {}); moveCssKey = null; }
    clickThrough = true; win.setIgnoreMouseEvents(true, { forward: true });
  }
  buildMenu();
}

function openSetup() {
  if (setupWin && !setupWin.isDestroyed()) { setupWin.focus(); return; }
  setupWin = new BrowserWindow({
    width: 460, height: 300, resizable: false, title: "트리 위젯 설정", autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { preload: path.join(__dirname, "setup-preload.js"), contextIsolation: true, sandbox: true }
  });
  setupWin.loadFile(path.join(__dirname, "setup.html"), { query: { url: cfg.siteUrl || "" } });
  setupWin.on("closed", () => { setupWin = null; if (!cfg.siteUrl) app.quit(); });
}
ipcMain.handle("setup:save", (_e, url) => {
  let u;
  try { u = new URL(String(url).trim()); } catch { return "주소 형식이 올바르지 않아요."; }
  if (u.protocol !== "https:" && u.hostname !== "localhost") return "https:// 로 시작하는 주소를 넣어주세요.";
  u.search = ""; u.hash = "";
  cfg.siteUrl = u.toString(); saveCfg();
  if (win && !win.isDestroyed()) win.loadURL(widgetUrl()); else createWidget();
  buildMenu();
  setTimeout(() => setupWin && setupWin.close(), 300);
  return "";
});

function buildMenu() {
  if (!tray) return;
  const corner = (id, label) => ({ label, type: "radio", checked: cfg.corner === id, click: () => { cfg.corner = id; saveCfg(); placeWin(); buildMenu(); } });
  const size = (id, label) => ({ label, type: "radio", checked: cfg.size === id, click: () => { cfg.size = id; saveCfg(); placeWin(); buildMenu(); } });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "트리 웹사이트 열기", enabled: !!cfg.siteUrl, click: () => shell.openExternal(cfg.siteUrl) },
    { type: "separator" },
    { label: win && win.isVisible() ? "트리 숨기기" : "트리 보이기", enabled: !!win, click: () => { if (win.isVisible()) win.hide(); else win.showInactive(); buildMenu(); } },
    { label: "드래그해서 옮기기", type: "checkbox", checked: moveMode, enabled: !!win, click: (i) => setMoveMode(i.checked) },
    { label: "위치", submenu: [corner("bottom-right", "오른쪽 아래"), corner("bottom-left", "왼쪽 아래"), corner("top-right", "오른쪽 위"), corner("top-left", "왼쪽 위"), { label: "직접 옮긴 자리", type: "radio", checked: cfg.corner === "custom", enabled: cfg.x != null, click: () => { cfg.corner = "custom"; saveCfg(); placeWin(); buildMenu(); } }] },
    { label: "크기", submenu: [size("S", "작게"), size("M", "보통"), size("L", "크게")] },
    { label: "눈 내리기", type: "checkbox", checked: cfg.snow, click: (i) => { cfg.snow = i.checked; saveCfg(); if (win) win.loadURL(widgetUrl()); } },
    { label: "새로고침", enabled: !!win, click: () => win.loadURL(widgetUrl()) },
    { type: "separator" },
    { label: "윈도우 시작할 때 자동 실행", type: "checkbox", checked: cfg.autoStart, click: (i) => { cfg.autoStart = i.checked; saveCfg(); app.setLoginItemSettings({ openAtLogin: i.checked }); } },
    { label: "사이트 주소 바꾸기…", click: openSetup },
    { label: "종료", click: () => app.quit() }
  ]));
}

app.whenReady().then(() => {
  loadCfg();
  if (process.platform === "win32") app.setAppUserModelId("bongo.tree.widget");
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "tray.png")));
  tray.setToolTip("크리스마스 트리 위젯 (오른쪽 클릭: 메뉴)");
  tray.on("click", () => { if (win) { if (win.isVisible()) win.hide(); else win.showInactive(); buildMenu(); } });
  if (cfg.siteUrl) createWidget(); else openSetup();
  buildMenu();
  screen.on("display-metrics-changed", () => win && placeWin());
});
app.on("second-instance", () => { if (win) win.showInactive(); else openSetup(); });
app.on("window-all-closed", () => { /* 트레이에 계속 남아 있음 */ });
