// 크리스마스 트리 위젯 — 모니터 구석에 항상 떠 있는 투명 창
const { app, BrowserWindow, Tray, Menu, shell, screen, nativeImage, ipcMain, Notification } = require("electron");
const path = require("path");
const fs = require("fs");

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const APP_ID = "xmastree.widget";   // package.json build.appId 와 같아야 해요
const LOGIN_NAME = "TreeWidget";       // 자동 실행 레지스트리 이름 (제거할 때 installer.nsh 가 지워요)
const BASE = [230, 302];               // 100% 크기
const SCALE_MIN = 0.55, SCALE_MAX = 2.2;
const SNAP = 16;                       // 화면 가장자리에 이만큼 가까우면 착 붙어요
const MARGIN = 8;                      // 모서리 위치일 때 가장자리와 띄우는 거리
const CORNERS = { "bottom-right": "오른쪽 아래", "bottom-left": "왼쪽 아래", "top-right": "오른쪽 위", "top-left": "왼쪽 위" };
const PRESETS = [[0.75, "작게"], [1, "보통"], [1.3, "크게"], [1.6, "아주 크게"]];

const CONFIG_FILE = () => path.join(app.getPath("userData"), "config.json");
const DEFAULTS = { siteUrl: "", corner: "bottom-right", displayId: null, scale: 1, snow: true, x: null, y: null, autoStart: true, firstRunDone: false };
let cfg = { ...DEFAULTS };
let win = null, setupWin = null, tray = null, clickThrough = true;
let drag = null, saveTimer = null, resizeAnchor = null;

/* ---------- 설정 ---------- */
function loadCfg() {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(CONFIG_FILE(), "utf8")); } catch {}
  cfg = { ...DEFAULTS, ...raw };
  // 예전 버전(작게/보통/크게)에서 넘어온 설정
  if (raw.size && raw.scale == null) cfg.scale = { S: 0.74, M: 1, L: 1.3 }[raw.size] || 1;
  delete cfg.size;
  if (raw.autoStart === undefined && raw.siteUrl) cfg.autoStart = false; // 예전 사용자는 그대로
  cfg.scale = clamp(Number(cfg.scale) || 1, SCALE_MIN, SCALE_MAX);
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
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveCfg(); buildMenu(); }, 400); }
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function widgetUrl() {
  const u = new URL(cfg.siteUrl);
  u.searchParams.set("widget", "1");
  if (!cfg.snow) u.searchParams.set("snow", "0");
  return u.toString();
}

function setAutoStart(on) {
  cfg.autoStart = on;
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: on, name: LOGIN_NAME });
}

/* ---------- 위치와 크기 ---------- */
const sizeNow = () => [Math.round(BASE[0] * cfg.scale), Math.round(BASE[1] * cfg.scale)];
const displayOf = (b) => screen.getDisplayMatching(b);
function displayById(id) { return screen.getAllDisplays().find((d) => d.id === id) || screen.getPrimaryDisplay(); }

function cornerPos(corner, area, w, h) {
  const right = area.x + area.width - w - MARGIN, bottom = area.y + area.height - h - MARGIN;
  switch (corner) {
    case "top-left": return [area.x + MARGIN, area.y + MARGIN];
    case "top-right": return [right, area.y + MARGIN];
    case "bottom-left": return [area.x + MARGIN, bottom];
    default: return [right, bottom];
  }
}
function visibleEnough(x, y, w, h) {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea, cx = x + w / 2, cy = y + h / 2;
    return cx >= a.x && cx <= a.x + a.width && cy >= a.y && cy <= a.y + a.height;
  });
}
function targetBounds() {
  const [w, h] = sizeNow();
  if (cfg.corner === "custom" && cfg.x != null && visibleEnough(cfg.x, cfg.y, w, h)) return { x: cfg.x, y: cfg.y, width: w, height: h };
  const corner = CORNERS[cfg.corner] ? cfg.corner : "bottom-right";
  const [x, y] = cornerPos(corner, displayById(cfg.displayId).workArea, w, h);
  return { x, y, width: w, height: h };
}
function setBoundsSafe(b) {
  if (!win || win.isDestroyed()) return;
  const r = { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
  win.setBounds(r);
}
function placeWin() { setBoundsSafe(targetBounds()); }

// 크기를 바꿀 때 화면 가장자리에 가까운 쪽 모서리를 고정해요 (오른쪽 아래에 있으면 오른쪽 아래가 그대로)
function resizeTo(scale) {
  if (!win) return;
  const old = win.getBounds();
  cfg.scale = clamp(Math.round(scale * 100) / 100, SCALE_MIN, SCALE_MAX);
  const [w, h] = sizeNow();
  if (CORNERS[cfg.corner]) { placeWin(); }
  else {
    const a = displayOf(old).workArea;
    // 가까운 가장자리 쪽을 고정. 연달아 조절하는 동안(1.5초)은 처음 정한 쪽을 그대로 써서 흔들리지 않게
    if (!resizeAnchor || Date.now() > resizeAnchor.until) {
      resizeAnchor = {
        right: a.x + a.width - (old.x + old.width) < old.x - a.x,
        bottom: a.y + a.height - (old.y + old.height) < old.y - a.y
      };
    }
    resizeAnchor.until = Date.now() + 1500;
    const { right, bottom } = resizeAnchor;
    let x = right ? old.x + old.width - w : old.x, y = bottom ? old.y + old.height - h : old.y;
    x = clamp(x, a.x, a.x + a.width - w); y = clamp(y, a.y, a.y + a.height - h);
    setBoundsSafe({ x, y, width: w, height: h });
    cfg.x = Math.round(x); cfg.y = Math.round(y);
  }
  saveSoon();
}

// 끌어서 옮기기: 렌더러가 시작/끝만 알려주고, 움직임은 여기서 커서 위치를 따라가요 (창 밖으로 빨리 움직여도 안 놓쳐요)
function startDrag() {
  if (!win || drag) return;
  const b = win.getBounds(), c = screen.getCursorScreenPoint();
  drag = { ox: c.x - b.x, oy: c.y - b.y, w: b.width, h: b.height, started: Date.now() };
  win.setIgnoreMouseEvents(false);
  drag.timer = setInterval(() => {
    if (!win || win.isDestroyed()) return endDrag();
    if (Date.now() - drag.started > 120000) return endDrag(); // 혹시 끝 신호를 놓쳐도 2분 뒤엔 멈춰요
    const p = screen.getCursorScreenPoint();
    let x = p.x - drag.ox, y = p.y - drag.oy;
    const a = screen.getDisplayNearestPoint(p).workArea;
    if (Math.abs(x - a.x) < SNAP) x = a.x;
    if (Math.abs(x + drag.w - (a.x + a.width)) < SNAP) x = a.x + a.width - drag.w;
    if (Math.abs(y - a.y) < SNAP) y = a.y;
    if (Math.abs(y + drag.h - (a.y + a.height)) < SNAP) y = a.y + a.height - drag.h;
    setBoundsSafe({ x, y, width: drag.w, height: drag.h });
  }, 16);
}
function endDrag() {
  if (!drag) return;
  clearInterval(drag.timer);
  drag = null;
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  cfg.corner = "custom"; cfg.x = b.x; cfg.y = b.y; cfg.displayId = displayOf(b).id;
  saveCfg(); buildMenu();
  clickThrough = false; // 손이 아직 트리 위에 있어요. 다음 mousemove 때 다시 판단
}

/* ---------- 창 ---------- */
function createWidget() {
  const b = targetBounds();
  win = new BrowserWindow({
    ...b, transparent: true, frame: false, resizable: false, maximizable: false,
    minimizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false,
    backgroundColor: "#00000000", show: false, title: "크리스마스 트리",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true }
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(true, { forward: true });
  try { Promise.resolve(win.webContents.setVisualZoomLevelLimits(1, 1)).catch(() => {}); } catch {}
  win.webContents.on("before-input-event", (e, input) => {
    // Ctrl+'+'/'-'/'0' 로 페이지가 확대되지 않게 (크기는 창으로 조절해요)
    if (input.control && ["+", "-", "=", "0"].includes(input.key)) e.preventDefault();
  });

  // 트리를 누르면 열리는 링크 → 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.includes("widget=1")) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  win.webContents.on("did-fail-load", (_e, code, _d, _u, isMain) => {
    if (code === -3 || !isMain) return; // 취소됨
    setTimeout(() => win && !win.isDestroyed() && win.loadURL(widgetUrl()), 30000);
  });
  win.once("ready-to-show", () => { win.showInactive(); firstRunTip(); });
  win.on("closed", () => { win = null; });
  win.loadURL(widgetUrl());
}

function firstRunTip() {
  if (cfg.firstRunDone) return;
  cfg.firstRunDone = true;
  if (cfg.autoStart) setAutoStart(true);
  saveCfg(); buildMenu();
  if (Notification.isSupported())
    new Notification({ title: "트리가 떴어요!", body: "트리를 꾹 눌러 끌면 원하는 자리로 옮겨져요. Ctrl + 마우스 휠로 크기를 바꿀 수 있어요.", icon: path.join(__dirname, "icon.png") }).show();
}

// 투명한 빈 곳은 클릭이 뒤로 통과, 트리 위에서만 클릭됨
ipcMain.on("tree:solid", (_e, solid) => {
  if (!win || drag) return;
  const want = !solid;
  if (want !== clickThrough) { clickThrough = want; win.setIgnoreMouseEvents(want, { forward: true }); }
});
ipcMain.on("drag:start", startDrag);
ipcMain.on("drag:end", endDrag);
ipcMain.on("resize:step", (_e, dir) => resizeTo(cfg.scale * (dir > 0 ? 1.08 : 1 / 1.08)));

/* ---------- 사이트 주소 설정 창 ---------- */
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

/* ---------- 트레이 메뉴 ---------- */
function buildMenu() {
  if (!tray) return;
  const displays = screen.getAllDisplays();
  const curDisplay = win ? displayOf(win.getBounds()).id : cfg.displayId;
  const corner = (id) => ({
    label: CORNERS[id], type: "radio", checked: cfg.corner === id,
    click: () => { cfg.corner = id; cfg.displayId = curDisplay; saveCfg(); placeWin(); buildMenu(); }
  });
  const posMenu = [
    ...Object.keys(CORNERS).map(corner),
    { label: "직접 옮긴 자리", type: "radio", checked: cfg.corner === "custom", enabled: cfg.x != null, click: () => { cfg.corner = "custom"; saveCfg(); placeWin(); buildMenu(); } }
  ];
  if (displays.length > 1) {
    posMenu.push({ type: "separator" });
    displays.forEach((d, i) => posMenu.push({
      label: `모니터 ${i + 1}${d.id === screen.getPrimaryDisplay().id ? " (주 모니터)" : ""}`, type: "radio", checked: d.id === curDisplay,
      click: () => { cfg.displayId = d.id; if (!CORNERS[cfg.corner]) cfg.corner = "bottom-right"; saveCfg(); placeWin(); buildMenu(); }
    }));
  }
  const pct = Math.round(cfg.scale * 100);
  const sizeMenu = [
    { label: `지금 ${pct}%  ·  Ctrl + 휠로 세밀하게`, enabled: false },
    { type: "separator" },
    ...PRESETS.map(([s, name]) => ({ label: `${name} (${Math.round(s * 100)}%)`, type: "radio", checked: Math.abs(cfg.scale - s) < 0.005, click: () => { resizeTo(s); buildMenu(); } })),
    { type: "separator" },
    { label: "조금 크게", click: () => { resizeTo(cfg.scale * 1.1); buildMenu(); } },
    { label: "조금 작게", click: () => { resizeTo(cfg.scale / 1.1); buildMenu(); } }
  ];
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "트리 웹사이트 열기", enabled: !!cfg.siteUrl, click: () => shell.openExternal(cfg.siteUrl) },
    { type: "separator" },
    { label: win && win.isVisible() ? "트리 숨기기" : "트리 보이기", enabled: !!win, click: () => { if (win.isVisible()) win.hide(); else win.showInactive(); buildMenu(); } },
    { label: "위치", submenu: posMenu },
    { label: "크기", submenu: sizeMenu },
    { label: "눈 내리기", type: "checkbox", checked: cfg.snow, click: (i) => { cfg.snow = i.checked; saveCfg(); if (win) win.loadURL(widgetUrl()); } },
    { label: "새로고침", enabled: !!win, click: () => win.loadURL(widgetUrl()) },
    { type: "separator" },
    { label: "윈도우 시작할 때 자동 실행", type: "checkbox", checked: cfg.autoStart, click: (i) => { setAutoStart(i.checked); saveCfg(); } },
    { label: "사이트 주소 바꾸기…", click: openSetup },
    { label: "종료", click: () => app.quit() }
  ]));
}

app.whenReady().then(() => {
  loadCfg();
  if (process.platform === "win32") app.setAppUserModelId(APP_ID);
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "tray.png")));
  tray.setToolTip("크리스마스 트리 위젯\n트리를 끌어서 옮기기 · Ctrl+휠로 크기 · 오른쪽 클릭: 메뉴");
  tray.on("click", () => { if (win) { if (win.isVisible()) win.hide(); else win.showInactive(); buildMenu(); } });
  if (cfg.siteUrl) createWidget(); else openSetup();
  buildMenu();
  const replace = () => { if (win && !drag) placeWin(); buildMenu(); };
  screen.on("display-metrics-changed", replace);
  screen.on("display-added", replace);
  screen.on("display-removed", replace);
});
app.on("second-instance", () => { if (win) win.showInactive(); else openSetup(); });
app.on("window-all-closed", () => { /* 트레이에 계속 남아 있음 */ });
app.on("before-quit", () => { if (drag) clearInterval(drag.timer); });
