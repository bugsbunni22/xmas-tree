// 위젯 창 안에서 마우스를 지켜보는 코드
// - 트리 그림 위에 있을 때만 클릭을 받고, 투명한 곳은 클릭이 뒤 창으로 넘어가요.
// - 트리를 꾹 눌러 끌면 창이 따라 움직여요. (살짝 누르고 떼면 원래대로 클릭)
// - Ctrl + 마우스 휠로 크기를 바꿔요.
const { ipcRenderer } = require("electron");

const DRAG_START_PX = 5;
let lastSolid = null;
let press = null;        // { x, y } 누른 곳
let dragging = false;
let swallowClick = false;

// 트리 그림(장식 포함) 위인지: #svg 안의 실제 도형이어야 해요. svg 바탕이나 감싸는 칸은 투명한 곳이에요.
function isSolid(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return false;
  const svg = document.getElementById("svg");
  return !!svg && el !== svg && svg.contains(el);
}
function report(solid) {
  if (solid !== lastSolid) { lastSolid = solid; ipcRenderer.send("tree:solid", solid); }
}

window.addEventListener("mousemove", (e) => {
  if (dragging) return;
  report(isSolid(e.clientX, e.clientY));
}, true);
window.addEventListener("mouseleave", () => { if (!dragging) report(false); });
document.addEventListener("mouseleave", () => { if (!dragging) report(false); });

window.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !isSolid(e.clientX, e.clientY)) return;
  press = { x: e.clientX, y: e.clientY, id: e.pointerId, target: e.target };
}, true);

window.addEventListener("pointermove", (e) => {
  if (!press || dragging || !(e.buttons & 1)) return;
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_START_PX) return; // 끌기 전엔 창이 안 움직이니 창 안 좌표로 충분
  dragging = true;
  try { press.target.setPointerCapture(press.id); } catch (_) {}
  document.documentElement.style.cursor = "grabbing";
  ipcRenderer.send("drag:start");
}, true);

function endDrag() {
  if (dragging) {
    dragging = false;
    swallowClick = true; // 끌기 뒤에 따라오는 클릭은 "사이트 열기"로 치지 않아요
    setTimeout(() => { swallowClick = false; }, 300);
    document.documentElement.style.cursor = "";
    ipcRenderer.send("drag:end");
  }
  press = null;
}
window.addEventListener("pointerup", endDrag, true);
window.addEventListener("pointercancel", endDrag, true);
window.addEventListener("lostpointercapture", () => { if (dragging) endDrag(); }, true);
window.addEventListener("blur", () => { if (dragging) endDrag(); });

window.addEventListener("click", (e) => {
  if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

window.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  ipcRenderer.send("resize:step", e.deltaY < 0 ? 1 : -1);
}, { capture: true, passive: false });
