// 마우스가 트리(색칠된 부분) 위에 있을 때만 클릭을 받도록 메인 프로세스에 알려줌
const { ipcRenderer } = require("electron");
let last = null;
function report(solid) { if (solid !== last) { last = solid; ipcRenderer.send("tree:solid", solid); } }
window.addEventListener("mousemove", (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const empty = !el || el === document.documentElement || el === document.body || el.id === "svg" ||
    el.id === "stage" || el.tagName === "MAIN" || el.tagName === "CANVAS";
  report(!empty);
}, true);
window.addEventListener("mouseleave", () => report(false));
document.addEventListener("mouseleave", () => report(false));
