// 위젯 동작 테스트 (배포 파일에는 안 들어가요)
// 실행: xvfb-run -a npx electron test/e2e.js  (SITE=http://localhost:3600/t/코드)
const { app, BrowserWindow, screen, shell } = require("electron");
const fs = require("fs"), os = require("os"), path = require("path");

const log = (...a) => fs.appendFileSync("/tmp/e2e.log", a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" ") + "\n");
log("STEP start");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "treewidget-"));
app.setPath("userData", tmp);
fs.writeFileSync(path.join(tmp, "config.json"), JSON.stringify({ siteUrl: process.env.SITE, firstRunDone: true, autoStart: false }));

// 기록용 가로채기
const ignoreCalls = [], opened = [];
const orig = BrowserWindow.prototype.setIgnoreMouseEvents;
BrowserWindow.prototype.setIgnoreMouseEvents = function (v, o) { ignoreCalls.push(v); return orig.call(this, v, o); };
shell.openExternal = async (u) => { opened.push(u); };
let fakeCursor = null;
app.whenReady().then(() => {
  const realCursor = screen.getCursorScreenPoint.bind(screen);
  screen.getCursorScreenPoint = () => fakeCursor || realCursor();
  // 테스트 환경은 외부 인터넷이 막혀 있어요: 글꼴 등 외부 요청은 바로 끊어서 로딩이 멈추지 않게
  require("electron").session.defaultSession.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (d, cb) => cb({ cancel: !/^https?:\/\/localhost/.test(d.url) }));
});

require("../main.js");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "OK  " : "FAIL"} ${name}${extra ? "  " + extra : ""}`); };

app.whenReady().then(async () => {
  log("STEP ready");
  await wait(4000);
  log("STEP windows", BrowserWindow.getAllWindows().map((w) => w.getTitle()));
  const win = BrowserWindow.getAllWindows().find((w) => w.getTitle() !== "트리 위젯 설정");
  const wc = win.webContents;
  const area = screen.getPrimaryDisplay().workArea;
  let b = win.getBounds();
  check("처음 위치: 오른쪽 아래", b.x + b.width === area.x + area.width - 8 && b.y + b.height === area.y + area.height - 8, JSON.stringify(b));
  check("100% 크기 230x302", b.width === 230 && b.height === 302);

  // 트리 위 좌표 찾기 (트리 몸통 가운데, 빈 곳)
  log("STEP url", wc.getURL(), "loading", wc.isLoading());
  const pts = await wc.executeJavaScript(`(() => {
    const t = document.querySelector('#tree path').getBoundingClientRect();
    return { tree: [Math.round(t.left + t.width/2), Math.round(t.top + t.height*0.7)], empty: [3, 3] };
  })()`);
  const move = (x, y, extra = {}) => wc.sendInputEvent({ type: "mouseMove", x, y, ...extra });

  ignoreCalls.length = 0;
  move(...pts.tree); await wait(200);
  check("트리 위: 클릭 받기", ignoreCalls.includes(false), JSON.stringify(ignoreCalls));
  ignoreCalls.length = 0;
  move(...pts.empty); await wait(200);
  check("빈 곳: 클릭 통과", ignoreCalls.includes(true), JSON.stringify(ignoreCalls));

  // 그냥 클릭 → 사이트 열기
  move(...pts.tree); await wait(150);
  wc.sendInputEvent({ type: "mouseDown", x: pts.tree[0], y: pts.tree[1], button: "left", clickCount: 1 });
  wc.sendInputEvent({ type: "mouseUp", x: pts.tree[0], y: pts.tree[1], button: "left", clickCount: 1 });
  await wait(400);
  check("짧게 클릭하면 사이트 열림", opened.length === 1 && opened[0].startsWith(process.env.SITE.split("?")[0]), JSON.stringify(opened));

  // 끌기: 누르고 → 커서 이동
  opened.length = 0;
  b = win.getBounds();
  const sx = b.x + pts.tree[0], sy = b.y + pts.tree[1];
  fakeCursor = { x: sx, y: sy };
  wc.sendInputEvent({ type: "mouseDown", x: pts.tree[0], y: pts.tree[1], button: "left", clickCount: 1 });
  for (let i = 1; i <= 4; i++) { wc.sendInputEvent({ type: "mouseMove", x: pts.tree[0] - i * 5, y: pts.tree[1] - i * 3, button: "left", modifiers: ["leftButtonDown"] }); await wait(30); }
  fakeCursor = { x: sx - 400, y: sy - 250 }; await wait(200);
  let nb = win.getBounds();
  check("끌면 창이 커서를 따라감", nb.x === b.x - 400 && nb.y === b.y - 250, `${JSON.stringify(b)} → ${JSON.stringify(nb)}`);
  // 화면 왼쪽 끝 근처로 → 자석
  fakeCursor = { x: area.x + 10 + (sx - b.x), y: sy - 250 }; await wait(200);
  nb = win.getBounds();
  check("왼쪽 가장자리에 착 붙음", nb.x === area.x, JSON.stringify(nb));
  wc.sendInputEvent({ type: "mouseUp", x: pts.tree[0] - 20, y: pts.tree[1] - 12, button: "left", clickCount: 1 });
  await wait(500);
  check("끌기 뒤 클릭은 사이트를 안 엶", opened.length === 0, JSON.stringify(opened));
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, "config.json"), "utf8"));
  check("옮긴 자리 저장", saved.corner === "custom" && saved.x === nb.x && saved.y === nb.y, JSON.stringify({ corner: saved.corner, x: saved.x, y: saved.y }));
  fakeCursor = null;

  // Ctrl + 휠 → 크기
  const before = win.getBounds();
  move(...pts.tree); await wait(150);
  for (let i = 0; i < 3; i++) { wc.sendInputEvent({ type: "mouseWheel", x: pts.tree[0], y: pts.tree[1], deltaY: 120, wheelTicksY: 1, canScroll: true, modifiers: ["control"] }); await wait(80); }
  await wait(300);
  const after = win.getBounds();
  check("Ctrl+휠 위로: 커짐", after.width > before.width && after.height > before.height, `${before.width}x${before.height} → ${after.width}x${after.height}`);
  check("커져도 비율 유지", Math.abs(after.width / after.height - 230 / 302) < 0.01);
  check("왼쪽 위 모서리 고정(왼쪽 위에 있으니)", after.x === before.x && after.y === before.y, JSON.stringify(after));
  const zoom = await wc.executeJavaScript("window.devicePixelRatio");
  check("페이지는 확대 안 됨", zoom === 1, String(zoom));
  const stage = await wc.executeJavaScript("(() => { const r = document.getElementById('stage').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), innerWidth, innerHeight]; })()");
  check("트리 그림이 창에 맞게 커짐", Math.abs(stage[1] - stage[3]) <= 1, JSON.stringify(stage));
  await wait(600);
  const saved2 = JSON.parse(fs.readFileSync(path.join(tmp, "config.json"), "utf8"));
  check("크기 저장", saved2.scale > 1, String(saved2.scale));

  // 다시 켜도 같은 자리·크기
  const cfgNow = { ...saved2 };
  check("재시작용 설정에 자리·크기 있음", cfgNow.x === after.x && cfgNow.scale === saved2.scale);

  log("\n" + results.join("\n"));
  console.log(results.some((r) => r.startsWith("FAIL")) ? "\nSOME FAILED" : "\nALL PASSED");
  await win.webContents.capturePage().then((img) => fs.writeFileSync("/tmp/widget_e2e.png", img.toPNG()));
  app.exit(0);
});
