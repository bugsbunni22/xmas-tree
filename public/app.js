import { SITE } from "./config.js";

{
const params = new URLSearchParams(location.search);
const WIDGET = params.has("widget");
const SNOW_ON = params.get("snow") !== "0";
const SITE_URL = location.origin + location.pathname;
if (WIDGET) document.documentElement.classList.add("widget");

const TYPES = ["ball", "star", "bell", "candy", "gift", "heart", "flake", "sock"];
const TYPE_NAMES = { ball: "방울", star: "별", bell: "종", candy: "지팡이 사탕", gift: "선물 상자", heart: "하트", flake: "눈송이", sock: "양말" };
const COLORS = ["#d8323e", "#f3c34d", "#4aa3df", "#f27aa8", "#9b6bd6", "#8fd16a", "#d9dee3", "#ffffff"];

const OS = WIDGET ? 1.45 : 1.3; // 장식 크기
const $ = (id) => document.getElementById(id);
const svg = $("svg"), stage = $("stage"), bubble = $("bubble");

/* ---------- 트리 그리기 ---------- */
const TIERS = [ // [꼭대기 y, 밑동 y, 반폭]
  [28, 96, 46],
  [62, 152, 66],
  [100, 214, 88]
];
function tierPath([ay, by, hw]) {
  const n = 5, step = (hw * 2) / n;
  let d = `M100 ${ay} L${100 + hw} ${by}`;
  for (let i = 0; i < n; i++) {
    const x1 = 100 + hw - step * i, x2 = x1 - step;
    d += ` Q${(x1 + x2) / 2} ${by + 7} ${x2} ${by}`;
  }
  return d + " Z";
}
function capPath([ay, by, hw]) {
  const n = 5, step = (hw * 2) / n, y = by - 3;
  let d = `M${100 + hw - 2} ${y}`;
  for (let i = 0; i < n; i++) {
    const x1 = 100 + hw - 2 - (step - 0.8) * i, x2 = x1 - (step - 0.8);
    d += ` Q${(x1 + x2) / 2} ${y + 8} ${x2} ${y}`;
  }
  return d;
}
function starPoints(R, r, cx = 0, cy = 0) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
    p.push((cx + Math.cos(a) * rr).toFixed(2) + "," + (cy + Math.sin(a) * rr).toFixed(2));
  }
  return p.join(" ");
}
const SMALL_STAR = starPoints(7, 3);

function ornShape(type, c) {
  switch (type) {
    case "star": return `<polygon points="${SMALL_STAR}" fill="${c}" stroke="#0003" stroke-width=".6"/><circle cx="-1.5" cy="-2" r="1.2" fill="#fff" opacity=".6"/>`;
    case "bell": return `<path d="M-5 3.5Q-5-6 0-6Q5-6 5 3.5Z" fill="${c}"/><rect x="-6.5" y="2.5" width="13" height="2.4" rx="1.2" fill="${c}"/><circle cy="6" r="1.7" fill="#c9a640"/><circle cx="0" cy="-7.2" r="1.3" fill="none" stroke="#c9a640" stroke-width="1"/><path d="M-2.6-3Q-3 0-2.6 1.5" stroke="#fff" stroke-width="1" opacity=".55" fill="none"/>`;
    case "candy": return `<path d="M2.5 7.5V-3Q2.5-7-1.3-7Q-5-7-5-3.6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M2.5 7.5V-3Q2.5-7-1.3-7Q-5-7-5-3.6" fill="none" stroke="${c}" stroke-width="3.2" stroke-dasharray="2 2.2"/>`;
    case "gift": return `<rect x="-5.5" y="-3.5" width="11" height="10" rx="1.2" fill="${c}"/><rect x="-1.1" y="-3.5" width="2.2" height="10" fill="#f3c34d"/><rect x="-5.5" y=".2" width="11" height="2" fill="#f3c34d" opacity=".9"/><path d="M0-3.5Q-6-9-4.5-3.5M0-3.5Q6-9 4.5-3.5" stroke="#f3c34d" fill="none" stroke-width="1.5"/>`;
    case "heart": return `<path d="M0 6.5C-8.5 .5-6.5-7.5 0-3C6.5-7.5 8.5.5 0 6.5Z" fill="${c}"/><circle cx="-3" cy="-2.5" r="1.3" fill="#fff" opacity=".55"/>`;
    case "flake": return `<g stroke="${c}" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M0-7V7M-6.1-3.5 6.1 3.5M-6.1 3.5 6.1-3.5M-2-5.5 0-3.6 2-5.5M-2 5.5 0 3.6 2 5.5"/></g><circle r="1.6" fill="${c}"/>`;
    case "sock": return `<path d="M-2.5-5H3.5V2.5Q3.5 6.5-.5 6.5H-4.5Q-7 6.5-7 4.2Q-7 2-4.2 2H-2.5Z" fill="${c}"/><rect x="-3.5" y="-7.5" width="8" height="3.4" rx="1.2" fill="#fff"/><path d="M-6.5 5.5Q-4.5 4-4.5 6.5" fill="#fff" opacity=".8"/>`;
    default: return `<circle r="6" fill="${c}"/><rect x="-2" y="-8.6" width="4" height="3" rx=".8" fill="#c9a640"/><circle cx="-2.2" cy="-2.2" r="1.8" fill="#fff" opacity=".55"/><circle r="6" fill="none" stroke="#0002" stroke-width=".6"/>`;
  }
}

function buildTree() {
  const tiers = TIERS.map((t, i) => {
    return `<path d="${tierPath(t)}" fill="url(#g${i})"/>` +
      `<path d="M100 ${t[0] + 6} L${100 - t[2] * 0.55} ${t[1] - 2}" stroke="#ffffff10" stroke-width="10" stroke-linecap="round"/>`;
  }).join("");
  const caps = TIERS.map((t) => `<path d="${capPath(t)}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`).join("");
  const grads = TIERS.map((_, i) => `<linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${["#3aa56b", "#329a62", "#2b8f59"][i]}"/><stop offset="1" stop-color="${["#1d6c45", "#18603d", "#135535"][i]}"/></linearGradient>`).join("");
  svg.innerHTML = `<defs>${grads}
    <radialGradient id="glow"><stop offset="0" stop-color="#ffe9a3" stop-opacity=".9"/><stop offset="1" stop-color="#ffe9a3" stop-opacity="0"/></radialGradient>
    <radialGradient id="ground" cx=".5" cy=".3"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d4e4ee"/></radialGradient>
    <linearGradient id="trunk" x1="0" x2="1"><stop offset="0" stop-color="#6b4128"/><stop offset="1" stop-color="#4a2c1b"/></linearGradient></defs>
    <ellipse cx="100" cy="246" rx="92" ry="13" fill="url(#ground)" opacity=".95"/>
    <rect x="89" y="212" width="22" height="30" rx="3" fill="url(#trunk)"/>
    <g id="tree">${tiers}<g id="caps" opacity=".55">${caps}</g></g>
    <g id="orns"></g>
    <circle cx="100" cy="24" r="20" fill="url(#glow)"/>
    <polygon points="${starPoints(12, 5, 100, 24)}" fill="#f3c34d" stroke="#c9952a" stroke-width="1.2"/>
    <g id="ghost"></g>`;
}

function inTree(x, y) {
  for (const [ay, by, hw] of TIERS) {
    if (y < ay + 8 || y > by + 1) continue;
    const half = ((y - ay) / (by - ay)) * hw - 5;
    if (Math.abs(x - 100) <= half) return true;
  }
  return false;
}

/* ---------- 상태 ---------- */
let items = [];          // {id,type,color,x,y,from,note,at}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
// 브라우저마다 비밀 키를 하나 만들어 두고, 장식을 뗄 때 "내가 건 것"임을 증명해요
let myKey = store.get("tree-key");
if (!myKey) {
  const r = crypto.getRandomValues(new Uint8Array(24));
  myKey = Array.from(r, (b) => b.toString(16).padStart(2, "0")).join("");
  store.set("tree-key", myKey);
}
let mineIds = new Set((() => { try { return JSON.parse(store.get("tree-mine") || "[]"); } catch (e) { return []; } })());
const saveMine = () => store.set("tree-mine", JSON.stringify([...mineIds]));
// 관리자: 주소 끝에 ?admin=관리자키 로 한 번 들어오면 이 브라우저에 기억돼요
if (params.get("admin")) { store.set("tree-admin", params.get("admin")); history.replaceState(null, "", SITE_URL); }
const ADMIN = WIDGET ? "" : (store.get("tree-admin") || "");
const isMine = (o) => mineIds.has(o.id);
let seen = new Set();
let firstLoad = true;
let blizzardUntil = 0;
let api = null;          // {add, remove, snow}

const safeColor = (c) => (COLORS.includes(c) ? c : "#d8323e");
const safeType = (t) => (TYPES.includes(t) ? t : "ball");
const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

function clean(id, d) {
  const x = num(d.x, 0, 200), y = num(d.y, 0, 262);
  if (x === null || y === null) return null;
  return {
    id, x, y,
    type: safeType(d.type), color: safeColor(d.color),
    from: String(d.from || "익명").slice(0, 20),
    note: String(d.note || "").slice(0, 200),
    at: typeof d.at === "number" ? d.at : Date.now()
  };
}

function render() {
  const g = svg.querySelector("#orns");
  g.innerHTML = items.map((o) => {
    const t = `translate(${o.x.toFixed(1)}px,${o.y.toFixed(1)}px) scale(${OS})`;
    const isNew = !firstLoad && !seen.has(o.id);
    return `<g class="orn${isNew ? " pop" : ""}" data-id="${encodeURIComponent(o.id)}" style="--t:${t};transform:${t}"><circle r="9" fill="transparent"/>${ornShape(o.type, o.color)}</g>`;
  }).join("");
  items.forEach((o) => seen.add(o.id));
  firstLoad = false;
  const notes = items.filter((o) => o.note).length;
  $("count").textContent = items.length ? `장식 ${items.length}개 · 쪽지 ${notes}개` : "아직 장식이 없어요. 첫 장식을 걸어주세요!";
  renderMine();
}

function renderMine() {
  if (WIDGET) return;
  const mine = ADMIN ? items : items.filter(isMine);
  $("mineTitle").textContent = ADMIN ? `관리자 모드: 모든 장식 (${items.length})` : "내가 건 장식";
  $("mineWrap").hidden = !mine.length;
  const ul = $("mine");
  ul.textContent = "";
  for (const o of mine) {
    const li = document.createElement("li");
    const s = document.createElement("span");
    s.textContent = `${ADMIN ? o.from + " · " : ""}${TYPE_NAMES[o.type]} · ${o.note || "(쪽지 없음)"}`;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "떼기";
    b.onclick = async () => {
      b.disabled = true;
      try { await api.remove(o.id); } catch (e) { b.disabled = false; say(e.message || "떼지 못했어요. 잠시 뒤 다시 해주세요."); }
    };
    li.append(s, b);
    ul.append(li);
  }
}

/* ---------- 말풍선 ---------- */
let pinned = null;
function showBubble(o) {
  bubble.textContent = "";
  const b = document.createElement("b");
  b.textContent = o.from;
  bubble.append(b, document.createTextNode(o.note || `${TYPE_NAMES[o.type]}을(를) 걸어줬어요`));
  const sm = document.createElement("small");
  sm.textContent = new Date(o.at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  bubble.append(sm);
  const r = svg.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  const sx = r.width / 200, sy = r.height / 262;
  let left = r.left - sr.left + o.x * sx, top = r.top - sr.top + o.y * sy;
  bubble.hidden = false;
  const w = bubble.offsetWidth, h = bubble.offsetHeight;
  left = Math.max(w / 2 + 4, Math.min(sr.width - w / 2 - 4, left));
  if (top - h - 14 < 0) top = h + 18;
  bubble.style.left = left + "px";
  bubble.style.top = top + "px";
}
function hideBubble() { if (!pinned) bubble.hidden = true; }
const ornFromEvent = (e) => {
  const g = e.target.closest && e.target.closest(".orn");
  if (!g) return null;
  const id = decodeURIComponent(g.dataset.id);
  return items.find((o) => o.id === id) || null;
};
svg.addEventListener("pointerover", (e) => { const o = ornFromEvent(e); if (o && !pinned) showBubble(o); });
svg.addEventListener("pointerout", (e) => { if (ornFromEvent(e)) hideBubble(); });

/* ---------- 꾸미기 (웹사이트 모드) ---------- */
let pick = { type: "ball", color: COLORS[0] };
let spot = null;

function toSvg(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}
function drawGhost(p, set) {
  const g = svg.querySelector("#ghost");
  if (!p) { g.innerHTML = ""; return; }
  g.innerHTML = `<g class="ghost${set ? " set" : ""}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${OS})">${ornShape(pick.type, pick.color)}</g>`;
}
function say(t, ok) { const m = $("msg"); m.textContent = t; m.classList.toggle("ok", !!ok); }

function setupPanel() {
  $("title").textContent = SITE.title;
  $("subtitle").textContent = SITE.subtitle;
  document.title = SITE.title;
  const types = $("types");
  types.innerHTML = TYPES.map((t) => `<button type="button" data-t="${t}" aria-label="${TYPE_NAMES[t]}" title="${TYPE_NAMES[t]}" aria-pressed="${t === pick.type}"><svg viewBox="-10 -10 20 20" class="pv"></svg></button>`).join("");
  const colors = $("colors");
  colors.innerHTML = COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}" aria-label="색 ${c}" aria-pressed="${c === pick.color}"></button>`).join("");
  const refresh = () => {
    types.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.t === pick.type);
      b.querySelector("svg").innerHTML = ornShape(b.dataset.t, pick.color === "#ffffff" && b.dataset.t !== "flake" ? "#ffffff" : pick.color);
    });
    colors.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.c === pick.color));
    if (spot) drawGhost(spot, true);
  };
  types.onclick = (e) => { const b = e.target.closest("button"); if (b) { pick.type = b.dataset.t; refresh(); stage.classList.add("placing"); } };
  colors.onclick = (e) => { const b = e.target.closest("button"); if (b) { pick.color = b.dataset.c; refresh(); } };
  refresh();
  stage.classList.add("placing");

  svg.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || spot) return;
    const p = toSvg(e);
    drawGhost(inTree(p.x, p.y) ? p : null, false);
  });
  svg.addEventListener("pointerleave", () => { if (!spot) drawGhost(null); });
  svg.addEventListener("click", (e) => {
    const o = ornFromEvent(e);
    const p = toSvg(e);
    if (o) { pinned = pinned === o ? null : o; if (pinned) showBubble(o); else bubble.hidden = true; return; }
    if (inTree(p.x, p.y)) {
      spot = p; pinned = null; bubble.hidden = true;
      drawGhost(spot, true);
      $("placeHint").textContent = "자리 잡았어요! 다른 곳을 누르면 옮겨져요.";
      say("");
    } else { pinned = null; bubble.hidden = true; }
  });

  const from = $("from"), note = $("note");
  try { from.value = localStorage.getItem("tree-from") || ""; } catch (e) {}
  note.addEventListener("input", () => { $("len").textContent = note.value.length; });

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!api) return say("아직 연결 중이에요. 잠시만요.");
    if (!spot) return say("트리를 눌러 장식을 걸 자리를 먼저 정해주세요.");
    const name = from.value.trim();
    if (!name) { from.focus(); return say("보내는 사람 이름을 적어주세요."); }
    const mine = items.filter(isMine).length;
    if (mine >= SITE.maxPerPerson) return say(`한 사람당 ${SITE.maxPerPerson}개까지 걸 수 있어요. 아래에서 하나 떼고 다시 걸어주세요.`);
    $("hang").disabled = true;
    try {
      await api.add({ type: pick.type, color: pick.color, x: +spot.x.toFixed(1), y: +spot.y.toFixed(1), from: name, note: note.value.trim().slice(0, 200) });
      try { localStorage.setItem("tree-from", name); } catch (e) {}
      spot = null; drawGhost(null); note.value = ""; $("len").textContent = "0";
      $("placeHint").textContent = "트리의 초록 부분을 누르면 장식이 그 자리에 놓여요.";
      say("장식을 걸었어요! 고마워요.", true);
    } catch (err) {
      console.error(err);
      say(err.message || "걸지 못했어요. 인터넷 연결을 확인하고 다시 해주세요.");
    } finally { $("hang").disabled = false; }
  });

  let cool = 0;
  $("snowBtn").addEventListener("click", async () => {
    if (!api || Date.now() < cool) return;
    cool = Date.now() + 30000;
    $("snowBtn").disabled = true;
    setTimeout(() => { $("snowBtn").disabled = false; }, 30000);
    try { await api.snow(); say("트리에 1분 동안 함박눈이 내려요!", true); }
    catch (e) { console.error(e); say(e.message || "눈을 뿌리지 못했어요."); }
  });
}

/* ---------- 위젯 모드: 트리 누르면 사이트 열기 ---------- */
function setupWidget() {
  svg.addEventListener("click", (e) => {
    const o = ornFromEvent(e);
    if (o) {
      if (pinned === o) { pinned = null; bubble.hidden = true; }
      else { pinned = o; showBubble(o); }
      return;
    }
    if (e.target === svg) return; // 빈 공간
    window.open(SITE_URL, "_blank");
  });
}

/* ---------- 눈 ---------- */
const cv = $("snow"), ctx = cv.getContext("2d");
let flakes = [], W = 0, H = 0, dpr = 1;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
}
new ResizeObserver(resize).observe(cv);
function flake(top) {
  return { x: Math.random() * W, y: top ? Math.random() * H : -6, r: 0.8 + Math.random() * 2.2, vy: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.28 };
}
function tick() {
  const heavy = Date.now() < blizzardUntil;
  svg.querySelector("#caps")?.setAttribute("opacity", heavy ? "1" : ".55");
  let target = SNOW_ON ? Math.round((W * H) / (WIDGET ? 1800 : 6000)) : 0;
  if (heavy) target *= 4;
  if (reduce) target = Math.round(target / 3);
  target = Math.min(target, 600);
  while (flakes.length < target) flakes.push(flake(flakes.length < target / 2 && !heavy));
  if (flakes.length > target) flakes.length = target;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  if (WIDGET) { ctx.shadowColor = "rgba(40,60,80,.55)"; ctx.shadowBlur = 2; }
  const sp = (heavy ? 2.2 : 1) * (reduce ? 0.4 : 1) * (WIDGET ? 0.7 : 1);
  for (const f of flakes) {
    f.ph += 0.02; f.y += f.vy * sp * (1 + f.r / 3); f.x += Math.sin(f.ph) * 0.35 + (heavy ? 0.6 : 0);
    if (f.y > H + 4 || f.x > W + 6) Object.assign(f, flake(false));
    ctx.globalAlpha = 0.55 + f.r / 6;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (WIDGET ? 0.8 : 1), 0, 6.283); ctx.fill();
  }
  requestAnimationFrame(tick);
}

/* ---------- 데이터 연결 (Vercel /api) ---------- */
function loaded() { $("loadnote").hidden = true; }
let loadTimer = setTimeout(() => { $("loadnote").textContent = "연결이 늦어지고 있어요. 인터넷 연결을 확인해주세요."; }, 10000);

async function call(method, path, body) {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "x-tree-key": myKey, ...(ADMIN ? { "x-tree-admin": ADMIN } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  let data = {};
  try { data = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(data.error || "서버에 연결하지 못했어요.");
  return data;
}

let pollBusy = false;
async function refresh() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const d = await call("GET", "/api/tree");
    clearTimeout(loadTimer); loaded();
    const next = (Array.isArray(d.items) ? d.items : []).map((o) => clean(String(o.id), o)).filter(Boolean);
    const skew = typeof d.now === "number" ? Date.now() - d.now : 0;
    const su = Number(d.snowUntil) || 0;
    if (su + skew > blizzardUntil) blizzardUntil = Math.min(su + skew, Date.now() + 120000);
    // 지워진 내 장식은 목록에서도 정리
    const ids = new Set(next.map((o) => o.id));
    let changed = false;
    for (const id of mineIds) if (!ids.has(id) && !pendingIds.has(id)) { mineIds.delete(id); changed = true; }
    if (changed) saveMine();
    // 방금 건 장식이 캐시 때문에 아직 안 보이면 잠깐 유지
    for (const o of items) if (pendingIds.has(o.id) && !ids.has(o.id)) next.push(o);
    for (const id of pendingIds) if (ids.has(id)) pendingIds.delete(id);
    items = next.filter((o) => !removedIds.has(o.id));
    render();
  } catch (e) {
    console.error(e);
    $("loadnote").textContent = e.message || "장식을 불러오지 못했어요.";
    if (WIDGET) $("loadnote").hidden = true;
  } finally { pollBusy = false; }
}
const pendingIds = new Set(), removedIds = new Set();

api = {
  add: async (o) => {
    const { item } = await call("POST", "/api/tree", o);
    const c = clean(String(item.id), item);
    mineIds.add(c.id); saveMine(); pendingIds.add(c.id);
    setTimeout(() => pendingIds.delete(c.id), 30000);
    items.push(c); render();
  },
  remove: async (id) => {
    await call("DELETE", "/api/tree?id=" + encodeURIComponent(id));
    mineIds.delete(id); saveMine(); removedIds.add(id);
    setTimeout(() => removedIds.delete(id), 30000);
    items = items.filter((o) => o.id !== id); render();
  },
  snow: async () => {
    const d = await call("POST", "/api/snow");
    blizzardUntil = Math.min(Number(d.snowUntil) || Date.now() + 60000, Date.now() + 120000);
  }
};

buildTree();
if (WIDGET) setupWidget(); else setupPanel();
requestAnimationFrame(() => { resize(); tick(); });
refresh();
setInterval(() => { if (!document.hidden || WIDGET) refresh(); }, WIDGET ? 15000 : 10000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}
