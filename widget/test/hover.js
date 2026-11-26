// 위젯에서 쪽지 말풍선이 마우스를 따라 열리고 닫히는지 (배포 파일에는 안 들어가요)
const { app, BrowserWindow, shell } = require("electron");
const fs = require("fs"), os = require("os"), path = require("path");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "treewidget-"));
app.setPath("userData", tmp);
fs.writeFileSync(path.join(tmp, "config.json"), JSON.stringify({ siteUrl: process.env.SITE, firstRunDone: true, autoStart: false }));
const opened = [];
shell.openExternal = async (u) => { opened.push(u); };
app.whenReady().then(() => require("electron").session.defaultSession.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (d, cb) => cb({ cancel: !/^https?:\/\/localhost/.test(d.url) })));
require("../main.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
app.whenReady().then(async () => {
  await wait(4000);
  const win = BrowserWindow.getAllWindows()[0], wc = win.webContents;
  const vis = () => wc.executeJavaScript("!document.getElementById('bubble').hidden");
  const p = await wc.executeJavaScript(`(() => { const r = document.querySelector('.orn').getBoundingClientRect(); return [Math.round(r.left + r.width/2), Math.round(r.top + r.height/2)]; })()`);
  wc.sendInputEvent({ type: "mouseMove", x: p[0], y: p[1] }); await wait(200); out.push("올림: " + await vis());
  wc.sendInputEvent({ type: "mouseMove", x: 3, y: 3 }); await wait(200); out.push("빈 곳으로: " + await vis());
  wc.sendInputEvent({ type: "mouseMove", x: p[0], y: p[1] }); await wait(200); out.push("다시 올림: " + await vis());
  wc.sendInputEvent({ type: "mouseLeave", x: -5, y: -5 }); await wait(200); out.push("창 밖으로: " + await vis());
  wc.sendInputEvent({ type: "mouseMove", x: p[0], y: p[1] }); await wait(150);
  wc.sendInputEvent({ type: "mouseDown", x: p[0], y: p[1], button: "left", clickCount: 1 });
  wc.sendInputEvent({ type: "mouseUp", x: p[0], y: p[1], button: "left", clickCount: 1 }); await wait(300);
  out.push("장식 클릭: 쪽지 " + await vis() + ", 사이트 열림 " + opened.length);
  wc.sendInputEvent({ type: "mouseMove", x: 3, y: 3 }); await wait(200); out.push("클릭 뒤 벗어남: " + await vis());
  fs.writeFileSync("/tmp/hover_widget.log", out.join("\n"));
  app.exit(0);
});
