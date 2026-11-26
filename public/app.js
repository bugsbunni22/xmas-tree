import { SITE } from "./config.js";

{
const params = new URLSearchParams(location.search);
const WIDGET = params.has("widget");
const SNOW_ON = params.get("snow") !== "0";
const SITE_URL = location.origin + location.pathname;
if (WIDGET) document.documentElement.classList.add("widget");
// 주소: /, /new → 시작 화면(내 트리 목록, 트리 만들기)
//       /t/코드 → 트리, /t/코드/manage → 트리 관리, /admin → 관리자
const PATH = location.pathname.replace(/\/+$/, "") || "/";
const ROUTE = PATH.match(/^\/t\/([a-z2-9]{8})(\/manage)?$/);
const HOME = PATH === "/" || PATH === "/new";
const CREATE = !WIDGET && HOME;
const ADMIN_PAGE = !WIDGET && PATH === "/admin";
const TREE = ROUTE ? ROUTE[1] : "";
const MANAGE = !WIDGET && !!(ROUTE && ROUTE[2]);
const UNKNOWN = !HOME && !ADMIN_PAGE && !ROUTE;
const Q = "?t=" + TREE;
const treePath = (t) => "/t/" + t;
const managePath = (t) => "/t/" + t + "/manage";

const TYPES = ["ball", "star", "bell", "candy", "gift", "heart", "flake", "sock"];
const TYPE_NAMES = { ball: "방울", star: "별", bell: "종", candy: "지팡이 사탕", gift: "선물 상자", heart: "하트", flake: "눈송이", sock: "양말", drawing: "손그림" };
const PATTERNS = [["none", "없음"], ["stripe", "줄무늬"], ["dot", "물방울"], ["zigzag", "지그재그"], ["star", "별"], ["check", "체크"]];
const PRESETS = ["#d8323e", "#f3c34d", "#4aa3df", "#f27aa8", "#9b6bd6", "#8fd16a", "#ffffff", "#d9dee3", "#1f2a44", "#7a4a2a"];
const PAL_DEFAULT = ["#d8323e", "#f3c34d", "#4aa3df", "#ffffff", "#8fd16a", "#f27aa8", "#7a4a2a", "#1f2a44"];
const N = 16; // 그림판 칸 수
const OS = WIDGET ? 1.45 : 1.3; // 트리 위 장식 기본 배율

const $ = (id) => document.getElementById(id);
const svg = $("svg"), stage = $("stage"), bubble = $("bubble");
const HEX = /^#[0-9a-f]{6}$/i;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hex = (c, d) => (typeof c === "string" && HEX.test(c) ? c.toLowerCase() : d);
const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

/* ---------- 트리 ---------- */
const TIERS = [[28, 96, 46], [62, 152, 66], [100, 214, 88]]; // [꼭대기 y, 밑동 y, 반폭]
function tierPath([ay, by, hw]) {
  const n = 5, step = (hw * 2) / n;
  let d = `M100 ${ay} L${100 + hw} ${by}`;
  for (let i = 0; i < n; i++) { const x1 = 100 + hw - step * i, x2 = x1 - step; d += ` Q${(x1 + x2) / 2} ${by + 7} ${x2} ${by}`; }
  return d + " Z";
}
function capPath([, by, hw]) {
  const n = 5, step = (hw * 2) / n - 0.8, y = by - 3;
  let d = `M${100 + hw - 2} ${y}`;
  for (let i = 0; i < n; i++) { const x1 = 100 + hw - 2 - step * i, x2 = x1 - step; d += ` Q${(x1 + x2) / 2} ${y + 8} ${x2} ${y}`; }
  return d;
}
function starPoints(R, r, cx = 0, cy = 0) {
  const p = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; p.push((cx + Math.cos(a) * rr).toFixed(2) + "," + (cy + Math.sin(a) * rr).toFixed(2)); }
  return p.join(" ");
}
function buildTree() {
  const grads = TIERS.map((_, i) => `<linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${["#3aa56b", "#329a62", "#2b8f59"][i]}"/><stop offset="1" stop-color="${["#1d6c45", "#18603d", "#135535"][i]}"/></linearGradient>`).join("");
  const tiers = TIERS.map((t, i) => `<path d="${tierPath(t)}" fill="url(#g${i})"/><path d="M100 ${t[0] + 6} L${100 - t[2] * 0.55} ${t[1] - 2}" stroke="#ffffff10" stroke-width="10" stroke-linecap="round"/>`).join("");
  const caps = TIERS.map((t) => `<path d="${capPath(t)}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`).join("");
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
    if (Math.abs(x - 100) <= ((y - ay) / (by - ay)) * hw - 5) return true;
  }
  return false;
}

/* ---------- 장식 그리기 ---------- */
const SMALL_STAR = starPoints(7, 3);
function patternDef(id, p, c1, c2) {
  const bg = (w, h) => `<rect width="${w}" height="${h}" fill="${c1}"/>`;
  const wrap = (w, h, inner, extra = "") => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${extra}>${bg(w, h)}${inner}</pattern>`;
  switch (p) {
    case "stripe": return wrap(3.2, 3.2, `<rect width="1.4" height="3.2" fill="${c2}"/>`, ` patternTransform="rotate(40)"`);
    case "dot": return wrap(3.4, 3.4, `<circle cx="1.7" cy="1.7" r=".75" fill="${c2}"/>`);
    case "zigzag": return wrap(4, 3, `<path d="M0 2.2L1 .8 2 2.2 3 .8 4 2.2" fill="none" stroke="${c2}" stroke-width=".7"/>`);
    case "star": return wrap(5, 5, `<polygon points="${starPoints(1.5, 0.65, 2.5, 2.5)}" fill="${c2}"/>`);
    case "check": return wrap(3, 3, `<rect width="1.5" height="1.5" fill="${c2}"/><rect x="1.5" y="1.5" width="1.5" height="1.5" fill="${c2}"/>`);
    default: return "";
  }
}
// 모양별 몸통·장식. tag=true면 글자를 아래 꼬리표에 새겨요.
function shapeParts(t, F, c1, c2) {
  const gold = "#c9a640";
  switch (t) {
    case "star": return { s: `<polygon points="${SMALL_STAR}" fill="${F}" stroke="#0003" stroke-width=".6"/>`, ty: 0.9, ts: 0.72 };
    case "bell": return { s: `<circle cy="-7.2" r="1.3" fill="none" stroke="${gold}" stroke-width="1"/><path d="M-5 3.5Q-5-6 0-6Q5-6 5 3.5Z" fill="${F}"/><rect x="-6.5" y="2.5" width="13" height="2.4" rx="1.2" fill="${F}" stroke="#0002" stroke-width=".4"/><circle cy="6" r="1.7" fill="${gold}"/>`, ty: -1, ts: 0.78 };
    case "candy": return { s: `<path d="M2.5 7.5V-3Q2.5-7-1.3-7Q-5-7-5-3.6" fill="none" stroke="${c2}" stroke-width="3.2" stroke-linecap="round"/><path d="M2.5 7.5V-3Q2.5-7-1.3-7Q-5-7-5-3.6" fill="none" stroke="${c1}" stroke-width="3.2" stroke-dasharray="2 2.2"/>`, tag: true };
    case "gift": return { s: `<rect x="-5.5" y="-3.5" width="11" height="10" rx="1.2" fill="${F}"/><rect x="-1.1" y="-3.5" width="2.2" height="10" fill="${c2}"/><rect x="-5.5" y=".2" width="11" height="2" fill="${c2}" opacity=".9"/><path d="M0-3.5Q-6-9-4.5-3.5M0-3.5Q6-9 4.5-3.5" stroke="${c2}" fill="none" stroke-width="1.5"/>`, ty: 1.4, ts: 0.72 };
    case "heart": return { s: `<path d="M0 6.5C-8.5 .5-6.5-7.5 0-3C6.5-7.5 8.5.5 0 6.5Z" fill="${F}"/>`, ty: 0.6, ts: 0.82 };
    case "flake": return { s: `<g stroke="${c1}" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M0-7V7M-6.1-3.5 6.1 3.5M-6.1 3.5 6.1-3.5M-2-5.5 0-3.6 2-5.5M-2 5.5 0 3.6 2 5.5"/></g><circle r="1.8" fill="${c2}"/>`, tag: true };
    case "sock": return { s: `<path d="M-2.5-5H3.5V2.5Q3.5 6.5-.5 6.5H-4.5Q-7 6.5-7 4.2Q-7 2-4.2 2H-2.5Z" fill="${F}"/><rect x="-3.5" y="-7.5" width="8" height="3.4" rx="1.2" fill="${c2}"/><path d="M-6.8 4.8Q-5 3.4-4.4 6.5" fill="${c2}" opacity=".85"/>`, ty: -0.6, tx: 0.5, ts: 0.62 };
    default: return { s: `<rect x="-2" y="-8.6" width="4" height="3" rx=".8" fill="${gold}"/><circle r="6" fill="${F}"/><circle r="6" fill="none" stroke="#0002" stroke-width=".6"/>`, ty: 0.4, ts: 1 };
  }
}
function drawingParts(px, pal) {
  let s = "";
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      const v = px[y * N + x];
      let w = 1;
      while (x + w < N && px[y * N + x + w] === v) w++;
      if (v !== "0") s += `<rect x="${x - N / 2}" y="${y - N / 2}" width="${w + 0.03}" height="1.03" fill="${pal[+v - 1]}"/>`;
      x += w;
    }
  }
  return `<g transform="scale(.85)">${s}</g>`;
}
// d: 정리된 장식 디자인, uid: 문서 안에서 겹치지 않는 아이디
function ornSVG(d, uid) {
  let defs = "", body, txt = "";
  const chars = Array.from(d.text || "");
  if (d.kind === "drawing") {
    body = drawingParts(d.px, d.pal);
    if (chars.length) txt = textEl(chars, 0, 0, 1, "#ffffff");
  } else {
    let F = d.c1;
    if (d.pattern !== "none" && !["candy", "flake"].includes(d.type)) { defs = patternDef("p" + uid, d.pattern, d.c1, d.c2); F = `url(#p${uid})`; }
    const p = shapeParts(d.type, F, d.c1, d.c2);
    body = p.s;
    if (chars.length) {
      if (p.tag) {
        const w = 3.2 + chars.length * 3.2;
        txt = `<path d="M0 6.5V8" stroke="#c9a640" stroke-width=".6"/><rect x="${-w / 2}" y="8" width="${w}" height="5.4" rx="2.7" fill="#fff" stroke="#0002" stroke-width=".4"/>` + textEl(chars, 0, 10.75, 0.62, "#ffffff", true);
      } else {
        const solid = d.pattern === "none" ? d.c1 : d.c2;
        txt = textEl(chars, p.tx || 0, p.ty, p.ts, solid);
      }
    }
  }
  const shine = d.shine ? `<circle cx="-2.6" cy="-3" r="2.4" fill="#fff" opacity=".28"/><g transform="translate(4.6 -5.4)"><path class="tw" d="M0-2.6L.55-.55 2.6 0 .55.55 0 2.6-.55.55-2.6 0-.55-.55Z" fill="#fff"/></g><g transform="translate(-5 4)"><path class="tw" style="animation-delay:.8s" d="M0-1.6L.35-.35 1.6 0 .35.35 0 1.6-.35.35-1.6 0-.35-.35Z" fill="#fff"/></g>` : "";
  return `<g transform="rotate(${d.rot}) scale(${d.size})">${defs ? `<defs>${defs}</defs>` : ""}<circle r="9" fill="transparent"/>${body}${txt}${shine}</g>`;
}
function textEl(chars, x, y, scale, bgColor, onTag) {
  const fs = [7, 5.4, 4.2][chars.length - 1] * scale * (onTag ? 1.4 : 1);
  const dark = onTag || lum(bgColor) > 0.6;
  const fill = dark ? "#13241e" : "#ffffff", stroke = dark ? "#ffffff" : "#0000004d";
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Jua, sans-serif" font-size="${fs.toFixed(2)}" fill="${fill}" stroke="${onTag ? "none" : stroke}" stroke-width="${(fs * 0.14).toFixed(2)}" paint-order="stroke">${esc(chars.join(""))}</text>`;
}

// 서버나 편집기에서 온 값을 안전하게 정리
function cleanDesign(d) {
  const num = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
  const o = {
    kind: d.kind === "drawing" ? "drawing" : "shape",
    size: num(d.size, 0.6, 1.8, 1), rot: num(d.rot, -45, 45, 0), shine: d.shine === true,
    text: Array.from(typeof d.text === "string" ? d.text : "").slice(0, 3).join("")
  };
  if (o.kind === "drawing") {
    o.px = typeof d.px === "string" && /^[0-8]{256}$/.test(d.px) ? d.px : "0".repeat(256);
    o.pal = Array.from({ length: 8 }, (_, i) => hex(Array.isArray(d.pal) ? d.pal[i] : null, PAL_DEFAULT[i]));
  } else {
    o.type = TYPES.includes(d.type) ? d.type : "ball";
    o.c1 = hex(d.c1 || d.color, "#d8323e"); o.c2 = hex(d.c2, "#ffffff");
    o.pattern = PATTERNS.some(([p]) => p === d.pattern) ? d.pattern : "none";
  }
  return o;
}
function cleanItem(raw) {
  const x = Number(raw.x), y = Number(raw.y), id = String(raw.id || "");
  if (!/^[0-9a-z]{1,40}$/i.test(id) || !(x >= 0 && x <= 200 && y >= 0 && y <= 262)) return null;
  return { ...cleanDesign(raw), id, x, y, from: String(raw.from || "익명").slice(0, 20), note: String(raw.note || "").slice(0, 200), at: Number(raw.at) || Date.now() };
}

/* ---------- 상태 ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
store.del("tree-from"); // 예전 버전이 저장해 둔 이름은 지워요
let items = [], seen = new Set(), firstLoad = true, blizzardUntil = 0;
// 브라우저마다 비밀 키를 하나 만들어 두고, 장식을 뗄 때 "내가 건 것"임을 증명해요
let myKey = store.get("tree-key");
if (!myKey) {
  myKey = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  store.set("tree-key", myKey);
}
const MINE_KEY = "tree-mine:" + TREE; // 트리마다 따로
const mineIds = new Set((() => { try { return JSON.parse(store.get(MINE_KEY) || "[]"); } catch (e) { return []; } })());
const saveMine = () => store.set(MINE_KEY, JSON.stringify([...mineIds]));
if (params.get("admin")) { store.set("tree-admin", params.get("admin")); history.replaceState(null, "", SITE_URL); }
const ADMIN = WIDGET ? "" : store.get("tree-admin") || "";
const isMine = (o) => mineIds.has(o.id);
// 트리 주인 토큰: 트리를 만든 브라우저에 저장. 관리 링크(#own=…)로 다른 기기에도 옮길 수 있어요.
const owners = (() => { try { return JSON.parse(store.get("tree-owners") || "{}") || {}; } catch (e) { return {}; } })();
const saveOwners = () => store.set("tree-owners", JSON.stringify(owners));
if (!WIDGET && location.hash.startsWith("#own=")) {
  const tok = decodeURIComponent(location.hash.slice(5));
  if (/^[0-9a-f]{48}$/.test(tok) && TREE) { owners[TREE] = { token: tok, title: (owners[TREE] && owners[TREE].title) || "" }; saveOwners(); }
  history.replaceState(null, "", location.pathname + location.search);
}
const OWNER_TOKEN = WIDGET ? "" : (owners[TREE] && owners[TREE].token) || "";
const MY_TREE = !!OWNER_TOKEN;          // 진짜 내 트리 (이 브라우저가 주인)
const IS_OWNER = MY_TREE || !!ADMIN;    // 관리할 수 있음 (관리자는 모든 트리)
// 내가 주인인 트리들 (이 브라우저 기준)
function myTrees() {
  return Object.entries(owners).filter(([id, o]) => /^[a-z2-9]{8}$/.test(id) && o && o.token).map(([id, o]) => ({ id, title: o.title || "내 트리" }));
}

function render() {
  svg.querySelector("#orns").innerHTML = items.map((o) => {
    const t = `translate(${o.x.toFixed(1)}px,${o.y.toFixed(1)}px) scale(${OS})`;
    const isNew = !firstLoad && !seen.has(o.id);
    return `<g class="orn${isNew ? " pop" : ""}" data-id="${esc(o.id)}" style="--t:${t};transform:${t}">${ornSVG(o, "o" + o.id)}</g>`;
  }).join("");
  items.forEach((o) => seen.add(o.id));
  firstLoad = false;
  const notes = items.filter((o) => o.note).length;
  $("count").textContent = items.length ? `장식 ${items.length}개 · 쪽지 ${notes}개` : "아직 장식이 없어요. 첫 장식을 걸어주세요!";
  renderMine();
}

function renderMine() {
  if (WIDGET) return;
  const list = items.filter(isMine);
  $("mineTitle").textContent = "내가 건 장식";
  $("mineWrap").hidden = !list.length;
  const ul = $("mine");
  ul.textContent = "";
  for (const o of list) {
    const li = document.createElement("li");
    li.innerHTML = `<svg viewBox="-14 -14 28 28" aria-hidden="true">${ornSVG(o, "m" + o.id)}</svg>`;
    const s = document.createElement("span");
    s.textContent = `${TYPE_NAMES[o.kind === "drawing" ? "drawing" : o.type]} · ${o.note || "(쪽지 없음)"}`;
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
  bubble.append(b, document.createTextNode(o.note || `${TYPE_NAMES[o.kind === "drawing" ? "drawing" : o.type]}을(를) 걸어줬어요`));
  const sm = document.createElement("small");
  sm.textContent = new Date(o.at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  bubble.append(sm);
  const sr = stage.getBoundingClientRect(), pt = svg.createSVGPoint();
  pt.x = o.x; pt.y = o.y - 8 * o.size;
  const sp = pt.matrixTransform(svg.getScreenCTM());
  let left = sp.x - sr.left, top = sp.y - sr.top;
  bubble.hidden = false;
  const w = bubble.offsetWidth, h = bubble.offsetHeight;
  left = Math.max(w / 2 + 4, Math.min(sr.width - w / 2 - 4, left));
  if (top - h - 14 < 0) top = h + 18;
  bubble.style.left = left + "px";
  bubble.style.top = top + "px";
}
const ornFromEvent = (e) => {
  const g = e.target.closest && e.target.closest(".orn");
  return g ? items.find((o) => o.id === g.dataset.id) || null : null;
};
svg.addEventListener("pointerover", (e) => { const o = ornFromEvent(e); if (o && !pinned) showBubble(o); });
svg.addEventListener("pointerout", (e) => { if (ornFromEvent(e) && !pinned) bubble.hidden = true; });

/* ---------- 장식 공방 (웹사이트) ---------- */
let design = { kind: "shape", type: "ball", c1: "#d8323e", c2: "#ffffff", pattern: "none", shine: false, size: 1, rot: 0, text: "", px: "0".repeat(N * N), pal: PAL_DEFAULT.slice() };
let spot = null;
const say = (t, ok) => { const m = $("msg"); m.textContent = t; m.classList.toggle("ok", !!ok); };

function toSvg(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}
function drawGhost(p, set) {
  const g = svg.querySelector("#ghost");
  g.innerHTML = p ? `<g class="ghost${set ? " set" : ""}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${OS})">${ornSVG(cleanDesign(design), "gh")}</g>` : "";
}

function swatchRow(el, colors, get, set, labelOf) {
  el.innerHTML = colors.map((c, i) => `<button type="button" class="sw" data-i="${i}" style="background:${c}" aria-label="${labelOf ? labelOf(i) : "색 " + c}"></button>`).join("") +
    `<label class="sw custom" title="다른 색 고르기"><input type="color" aria-label="다른 색 고르기"></label>`;
  const input = el.querySelector("input");
  el.onclick = (e) => { const b = e.target.closest("button.sw"); if (b) set(colors[+b.dataset.i], +b.dataset.i); };
  input.oninput = () => set(input.value, -1);
  return () => {
    const cur = get();
    el.querySelectorAll("button.sw").forEach((b) => b.setAttribute("aria-pressed", colors[+b.dataset.i] === cur));
    const custom = el.querySelector(".custom");
    const isCustom = !colors.includes(cur);
    custom.setAttribute("aria-pressed", isCustom);
    custom.style.background = isCustom ? cur : "";
    input.value = cur;
  };
}

function setupPanel() {
  stage.classList.add("placing");

  const types = $("types"), pats = $("patterns");
  types.innerHTML = TYPES.map((t) => `<button type="button" data-t="${t}" aria-label="${TYPE_NAMES[t]}" title="${TYPE_NAMES[t]}"><svg viewBox="-10 -10 20 20"></svg></button>`).join("");
  pats.innerHTML = PATTERNS.map(([p, name]) => `<button type="button" data-p="${p}"><svg viewBox="-5 -5 10 10"></svg>${name}</button>`).join("");
  types.onclick = (e) => { const b = e.target.closest("button"); if (b) { design.type = b.dataset.t; update(); } };
  pats.onclick = (e) => { const b = e.target.closest("button"); if (b) { design.pattern = b.dataset.p; update(); } };
  const c1 = swatchRow($("c1Row"), PRESETS, () => design.c1, (c) => { design.c1 = c; update(); });
  const c2 = swatchRow($("c2Row"), PRESETS, () => design.c2, (c) => { design.c2 = c; update(); });

  $("tabShape").onclick = () => { design.kind = "shape"; update(); };
  $("tabDraw").onclick = () => { design.kind = "drawing"; update(); drawPad(); };

  const text = $("text");
  const clip = () => { const a = Array.from(text.value); if (a.length > 3) text.value = a.slice(0, 3).join(""); design.text = text.value.trim(); update(); };
  text.addEventListener("input", (e) => { if (!e.isComposing) clip(); });
  text.addEventListener("compositionend", clip);
  $("size").oninput = () => { design.size = +$("size").value; update(); };
  $("rot").oninput = () => { design.rot = +$("rot").value; update(); };
  $("shine").onchange = () => { design.shine = $("shine").checked; update(); };

  setupPad();

  // 폰 화면: ① 꾸미기 → ② 트리에 달기 (한 번에 한 단계)
  const narrow = matchMedia("(max-width: 820px)");
  const msg1 = document.createElement("div");
  msg1.className = "msg"; msg1.setAttribute("role", "status");
  $("next").after(msg1);
  const setStep = (n) => {
    document.body.dataset.step = String(n);
    $("go1").setAttribute("aria-selected", n === 1);
    $("go2").setAttribute("aria-selected", n === 2);
    msg1.textContent = "";
    if (narrow.matches) window.scrollTo({ top: 0 });
  };
  const toHang = () => {
    const d = cleanDesign(design);
    if (d.kind === "drawing" && !/[1-8]/.test(d.px)) { msg1.textContent = "그림판에 장식을 먼저 그려주세요."; return; }
    setStep(2);
  };
  $("go1").onclick = () => setStep(1);
  $("go2").onclick = () => setStep(2);
  $("next").onclick = toHang;
  $("back").onclick = () => setStep(1);
  setStep(1);

  function update() {
    const d = cleanDesign(design);
    $("pv").innerHTML = ornSVG(d, "pv");
    $("tabShape").setAttribute("aria-selected", design.kind === "shape");
    $("tabDraw").setAttribute("aria-selected", design.kind === "drawing");
    $("shapePane").hidden = design.kind !== "shape";
    $("drawPane").hidden = design.kind !== "drawing";
    types.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.t === design.type);
      b.querySelector("svg").innerHTML = ornSVG({ ...cleanDesign({ ...design, kind: "shape", type: b.dataset.t }), rot: 0, size: 1, text: "", shine: false }, "ty" + b.dataset.t);
    });
    pats.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.p === design.pattern);
      const p = b.dataset.p;
      b.querySelector("svg").innerHTML = p === "none" ? `<circle r="5" fill="${design.c1}"/>` : `<defs>${patternDef("pc" + p, p, design.c1, design.c2)}</defs><circle r="5" fill="url(#pc${p})"/>`;
    });
    c1(); c2(); palRefresh();
    $("sizeOut").textContent = Math.round(design.size * 100) + "%";
    $("rotOut").textContent = design.rot + "°";
    if (spot) drawGhost(spot, true);
  }
  window.__update = update;

  svg.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || spot) return;
    const p = toSvg(e);
    drawGhost(inTree(p.x, p.y) && !ornFromEvent(e) ? p : null, false);
  });
  svg.addEventListener("pointerleave", () => { if (!spot) drawGhost(null); });
  svg.addEventListener("click", (e) => {
    const o = ornFromEvent(e), p = toSvg(e);
    if (o) { pinned = pinned === o ? null : o; if (pinned) showBubble(o); else bubble.hidden = true; return; }
    pinned = null; bubble.hidden = true;
    if (inTree(p.x, p.y)) {
      spot = p; drawGhost(spot, true);
      $("placeHint").textContent = "자리 잡았어요! 다른 곳을 누르면 옮겨져요.";
      say("");
    }
  });

  const from = $("from"), note = $("note");
  note.addEventListener("input", () => { $("len").textContent = note.value.length; });
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = cleanDesign(design);
    if (d.kind === "drawing" && !/[1-8]/.test(d.px)) return say("그림판에 장식을 그려주세요.");
    if (!spot) return say("트리를 눌러 장식을 걸 자리를 먼저 정해주세요.");
    const name = from.value.trim();
    if (!name) { from.focus(); return say("보내는 사람 이름을 적어주세요."); }
    if (!IS_OWNER && items.filter(isMine).length >= SITE.maxPerPerson) return say(`한 사람당 ${SITE.maxPerPerson}개까지 걸 수 있어요. 아래에서 하나 떼고 다시 걸어주세요.`);
    $("hang").disabled = true;
    try {
      await api.add({ ...d, x: +spot.x.toFixed(1), y: +spot.y.toFixed(1), from: name, note: note.value.trim().slice(0, 200) });
      spot = null; drawGhost(null);
      from.value = ""; note.value = ""; $("len").textContent = "0";
      $("placeHint").textContent = "트리의 초록 부분을 누르면 장식이 그 자리에 놓여요.";
      say("장식을 걸었어요! 고마워요.", true);
    } catch (err) {
      console.error(err);
      say(err.message || "걸지 못했어요. 인터넷 연결을 확인하고 다시 해주세요.");
    } finally { $("hang").disabled = false; }
  });

  $("snowBtn").addEventListener("click", async () => {
    $("snowBtn").disabled = true;
    setTimeout(() => { $("snowBtn").disabled = false; }, 30000);
    try { await api.snow(); say("트리에 1분 동안 함박눈이 내려요!", true); }
    catch (e) { console.error(e); say(e.message || "눈을 뿌리지 못했어요."); }
  });

  update();
}

/* ---------- 그림판 ---------- */
let tool = "pen", mirror = false, palIdx = 1, undo = [], palRefresh = () => {}, drawPad = () => {};
function setupPad() {
  const pad = $("pad"), ctx = pad.getContext("2d"), C = pad.width / N;
  const setPx = (i, v) => { design.px = design.px.slice(0, i) + v + design.px.slice(i + 1); };
  drawPad = () => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = design.px[y * N + x];
      ctx.fillStyle = v === "0" ? ((x + y) % 2 ? "#f1f4f2" : "#ffffff") : design.pal[+v - 1];
      ctx.fillRect(x * C, y * C, C, C);
    }
    ctx.strokeStyle = "#00000014"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < N; i++) { ctx.moveTo(i * C + 0.5, 0); ctx.lineTo(i * C + 0.5, pad.height); ctx.moveTo(0, i * C + 0.5); ctx.lineTo(pad.width, i * C + 0.5); }
    ctx.stroke();
    if (mirror) { ctx.strokeStyle = "#d8323e66"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad.width / 2, 0); ctx.lineTo(pad.width / 2, pad.height); ctx.stroke(); }
  };
  const cell = (e) => {
    const r = pad.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * N), y = Math.floor(((e.clientY - r.top) / r.height) * N);
    return x >= 0 && x < N && y >= 0 && y < N ? [x, y] : null;
  };
  const paint = ([x, y]) => {
    const v = tool === "erase" ? "0" : String(palIdx);
    setPx(y * N + x, v);
    if (mirror) setPx(y * N + (N - 1 - x), v);
  };
  const fill = ([x, y]) => {
    const from = design.px[y * N + x], to = String(palIdx);
    if (from === to) return;
    const q = [[x, y]];
    while (q.length) {
      const [cx, cy] = q.pop();
      if (cx < 0 || cy < 0 || cx >= N || cy >= N || design.px[cy * N + cx] !== from) continue;
      setPx(cy * N + cx, to);
      q.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  };
  const pushUndo = () => { undo.push(design.px); if (undo.length > 40) undo.shift(); };
  let down = false;
  pad.addEventListener("pointerdown", (e) => {
    const c = cell(e); if (!c) return;
    pushUndo();
    if (tool === "fill") { fill(c); drawPad(); window.__update(); return; }
    down = true; pad.setPointerCapture(e.pointerId); paint(c); drawPad();
  });
  pad.addEventListener("pointermove", (e) => { if (!down) return; const c = cell(e); if (c) { paint(c); drawPad(); } });
  const end = () => { if (down) { down = false; window.__update(); } };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);

  const tools = { toolPen: "pen", toolErase: "erase", toolFill: "fill" };
  const toolRefresh = () => {
    for (const [id, t] of Object.entries(tools)) $(id).setAttribute("aria-pressed", tool === t);
    $("toolMirror").setAttribute("aria-pressed", mirror);
  };
  for (const [id, t] of Object.entries(tools)) $(id).onclick = () => { tool = t; toolRefresh(); };
  $("toolMirror").onclick = () => { mirror = !mirror; toolRefresh(); drawPad(); };
  $("toolUndo").onclick = () => { if (undo.length) { design.px = undo.pop(); drawPad(); window.__update(); } };
  document.querySelector(".tpl").onclick = (e) => {
    const b = e.target.closest("[data-tpl]"); if (!b) return;
    pushUndo(); design.px = template(b.dataset.tpl); drawPad(); window.__update();
  };

  const palEl = $("palRow");
  const refreshSw = swatchRow(palEl, design.pal, () => design.pal[palIdx - 1], (c, i) => {
    if (i >= 0) palIdx = i + 1;
    else { design.pal[palIdx - 1] = c; palEl.querySelector(`button[data-i="${palIdx - 1}"]`).style.background = c; drawPad(); }
    if (tool === "erase") { tool = "pen"; toolRefresh(); }
    window.__update();
  }, (i) => `물감 ${i + 1}`);
  palRefresh = () => {
    refreshSw();
    palEl.querySelectorAll("button.sw").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.i === palIdx - 1));
    const custom = palEl.querySelector(".custom");
    custom.setAttribute("aria-pressed", "false"); custom.style.background = "";
  };
  toolRefresh(); drawPad();
}
function template(name) {
  const a = Array(N * N).fill("0");
  const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < N && y < N) a[y * N + x] = v; };
  if (name === "ball") {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - 7.5) ** 2 + (y - 9) ** 2 <= 6.4 ** 2) put(x, y, "1");
    for (const [x, y] of [[7, 1], [8, 1], [7, 2], [8, 2], [6, 2], [9, 2]]) put(x, y, "2");
    for (const [x, y] of [[5, 6], [5, 7], [6, 5], [4, 8]]) put(x, y, "4");
  } else if (name === "heart") {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x + 0.5 - 8) / 6.4, v = -(y + 0.5 - 8.8) / 6.4; // 위아래 1칸씩 여백, 윗부분 볼록 두 개까지
      if ((u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0) put(x, y, "6");
    }
  } else if (name === "tree") {
    for (let y = 2; y < 13; y++) { const h = Math.floor((y - 1) * 0.62); for (let x = 7 - h; x <= 8 + h; x++) put(x, y, "5"); }
    for (let y = 13; y < 16; y++) { put(7, y, "7"); put(8, y, "7"); }
    for (const [x, y] of [[7, 0], [8, 0], [7, 1], [8, 1], [6, 1], [9, 1]]) put(x, y, "2");
    for (const [x, y] of [[6, 6], [9, 8], [5, 10], [10, 11], [8, 4]]) put(x, y, "1");
  }
  return a.join("");
}

/* ---------- 위젯: 트리를 누르면 사이트 열기 ---------- */
function setupWidget() {
  svg.addEventListener("click", (e) => {
    const o = ornFromEvent(e);
    if (o) { pinned = pinned === o ? null : o; if (pinned) showBubble(o); else bubble.hidden = true; return; }
    if (e.target === svg) return; // 빈 공간
    window.open(SITE_URL, "_blank");
  });
}

/* ---------- 눈 ---------- */
const cv = $("snow"), sctx = cv.getContext("2d");
let flakes = [], W = 0, H = 0, dpr = 1;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
function resize() { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; }
const snowObserver = new ResizeObserver(resize);
snowObserver.observe(cv);
const flake = (top) => ({ x: Math.random() * W, y: top ? Math.random() * H : -6, r: 0.8 + Math.random() * 2.2, vy: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.28 });
function tick() {
  const heavy = Date.now() < blizzardUntil;
  svg.querySelector("#caps")?.setAttribute("opacity", heavy ? "1" : ".55");
  let target = SNOW_ON ? Math.round((W * H) / (WIDGET ? 1800 : 6000)) : 0;
  if (heavy) target *= 4;
  if (reduce) target = Math.round(target / 3);
  target = Math.min(target, 600);
  while (flakes.length < target) flakes.push(flake(flakes.length < target / 2 && !heavy));
  if (flakes.length > target) flakes.length = target;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.clearRect(0, 0, W, H);
  sctx.fillStyle = "#fff";
  if (WIDGET) { sctx.shadowColor = "rgba(40,60,80,.55)"; sctx.shadowBlur = 2; }
  const sp = (heavy ? 2.2 : 1) * (reduce ? 0.4 : 1) * (WIDGET ? 0.7 : 1);
  for (const f of flakes) {
    f.ph += 0.02; f.y += f.vy * sp * (1 + f.r / 3); f.x += Math.sin(f.ph) * 0.35 + (heavy ? 0.6 : 0);
    if (f.y > H + 4 || f.x > W + 6) Object.assign(f, flake(false));
    sctx.globalAlpha = 0.55 + f.r / 6;
    sctx.beginPath(); sctx.arc(f.x, f.y, f.r * (WIDGET ? 0.8 : 1), 0, 6.283); sctx.fill();
  }
  requestAnimationFrame(tick);
}

/* ---------- 서버 (Vercel /api) ---------- */
const loadTimer = setTimeout(() => { $("loadnote").textContent = "연결이 늦어지고 있어요. 인터넷 연결을 확인해주세요."; }, 10000);
async function call(method, path, body) {
  const r = await fetch(path, {
    method, cache: "no-store",
    headers: { "Content-Type": "application/json", "x-tree-key": myKey, ...(ADMIN ? { "x-tree-admin": encodeURIComponent(ADMIN) } : {}), ...(OWNER_TOKEN ? { "x-tree-owner": OWNER_TOKEN } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error(data.error || "서버에 연결하지 못했어요."); err.status = r.status; throw err; }
  return data;
}
const pendingIds = new Set(), removedIds = new Set();
let pollBusy = false;
async function refresh() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const d = await call("GET", "/api/tree" + Q);
    clearTimeout(loadTimer); $("loadnote").hidden = true;
    applyTitle(d.title);
    const next = (Array.isArray(d.items) ? d.items : []).map(cleanItem).filter(Boolean);
    const skew = typeof d.now === "number" ? Date.now() - d.now : 0;
    const su = Number(d.snowUntil) || 0;
    if (su + skew > blizzardUntil) blizzardUntil = Math.min(su + skew, Date.now() + 120000);
    const ids = new Set(next.map((o) => o.id));
    let changed = false;
    for (const id of mineIds) if (!ids.has(id) && !pendingIds.has(id)) { mineIds.delete(id); changed = true; }
    if (changed) saveMine();
    for (const o of items) if (pendingIds.has(o.id) && !ids.has(o.id)) next.push(o); // 캐시 때문에 아직 안 보이는 내 새 장식
    for (const id of pendingIds) if (ids.has(id)) pendingIds.delete(id);
    items = next.filter((o) => !removedIds.has(o.id));
    render();
  } catch (e) {
    console.error(e);
    if (e.status === 404) { clearTimeout(loadTimer); showNotFound(); return; }
    $("loadnote").textContent = e.message || "장식을 불러오지 못했어요.";
    $("loadnote").hidden = WIDGET;
  } finally { pollBusy = false; }
}
const api = {
  async add(o) {
    const { item } = await call("POST", "/api/tree" + Q, o);
    const c = cleanItem(item);
    mineIds.add(c.id); saveMine(); pendingIds.add(c.id);
    setTimeout(() => pendingIds.delete(c.id), 30000);
    items.push(c); render();
  },
  async remove(id) {
    await call("DELETE", "/api/tree" + Q + "&id=" + encodeURIComponent(id));
    mineIds.delete(id); saveMine(); removedIds.add(id);
    setTimeout(() => removedIds.delete(id), 30000);
    items = items.filter((o) => o.id !== id); render();
  },
  async snow() {
    const d = await call("POST", "/api/snow" + Q);
    blizzardUntil = Math.min(Number(d.snowUntil) || Date.now() + 60000, Date.now() + 120000);
  }
};

/* ---------- 머리말: 트리 이름, 내 트리 / 남의 트리 표시, 바로가기 버튼 ---------- */
let treeTitle = "", stopped = false;
function applyTitle(t) {
  const title = t || "크리스마스 트리";
  if (WIDGET || title === treeTitle) return;
  treeTitle = title;
  $("title").textContent = title;
  document.title = title;
  if (OWNER_TOKEN && owners[TREE] && owners[TREE].title !== title) { owners[TREE].title = title; saveOwners(); }
  const ri = $("renameInput");
  if (ri && document.activeElement !== ri) ri.value = title;
}
function headLink(text, href, solid) {
  const a = document.createElement("a");
  a.className = "mk" + (solid ? " solid" : "");
  a.href = href;
  a.textContent = text;
  return a;
}
function setupHeader() {
  const badge = $("badge"), btns = $("headBtns");
  btns.textContent = "";
  if (MY_TREE) { badge.textContent = "내 트리"; badge.className = "badge is-mine"; }
  else if (ADMIN) { badge.textContent = "관리자로 보는 중"; badge.className = "badge is-admin"; }
  else { badge.textContent = "친구 트리"; badge.className = "badge"; }
  badge.hidden = false;
  $("subtitle").textContent = MY_TREE ? "링크를 친구들에게 보내서 장식을 받아 보세요." : SITE.subtitle;
  if (IS_OWNER) btns.append(headLink("트리 관리", managePath(TREE), true));
  if (!MY_TREE) {
    const mine = myTrees().filter((t) => t.id !== TREE);
    if (mine.length === 1) btns.append(headLink("내 트리로 가기", treePath(mine[0].id)));
    else if (mine.length > 1) btns.append(headLink("내 트리 보기", "/"));
    else btns.append(headLink("나도 트리 만들기", "/"));
  }
  if (ADMIN) btns.append(headLink("관리자", "/admin"));
}

// 트리 대신 다른 화면(만들기, 관리, 관리자, 없는 트리)을 보여줄 때
function showPage(id, title, lead) {
  stopped = true;
  document.documentElement.classList.add("page"); // 긴 목록도 스크롤되게
  document.querySelector("main").hidden = true;
  document.querySelector(".stepnav").hidden = true;
  $("count").hidden = true;
  for (const v of ["createView", "manageView", "adminView"]) $(v).hidden = v !== id;
  $("title").textContent = title;
  $("subtitle").textContent = lead;
  document.title = title;
}
let toastTimer = null;
function toast(t, ok) {
  const el = $("toast");
  el.textContent = t;
  el.classList.toggle("ok", !!ok);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}
async function copyText(input) {
  input.select();
  try { await navigator.clipboard.writeText(input.value); toast("복사했어요!", true); }
  catch (e) { try { document.execCommand("copy"); toast("복사했어요!", true); } catch (_) { toast("주소를 길게 눌러 직접 복사해 주세요."); } }
}
const dateText = (ms) => (ms ? new Date(ms).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-");

/* ---------- 트리 관리 페이지 (/t/코드/manage, /manage) ---------- */
async function setupManage() {
  showPage("manageView", "트리 관리", "");
  $("headBtns").textContent = "";
  $("headBtns").append(headLink("← 트리로 가기", treePath(TREE)));
  if (ADMIN) $("headBtns").append(headLink("관리자", "/admin"));
  if (!IS_OWNER) {
    $("mDenied").hidden = false;
    $("mPanels").hidden = true;
    $("mBack").href = treePath(TREE);
    $("subtitle").textContent = "트리를 만든 브라우저나 관리 링크로 연 기기에서만 볼 수 있어요.";
    return;
  }
  $("badge").hidden = false;
  $("badge").textContent = MY_TREE ? "내 트리" : "관리자로 관리 중";
  $("badge").className = "badge " + (MY_TREE ? "is-mine" : "is-admin");
  const share = location.origin + treePath(TREE);
  $("shareUrl").value = share;
  $("toTree").href = treePath(TREE);
  $("copyShare").onclick = () => copyText($("shareUrl"));
  if (OWNER_TOKEN) { $("manageUrl").value = location.origin + treePath(TREE) + "#own=" + OWNER_TOKEN; $("copyManage").onclick = () => copyText($("manageUrl")); }
  else $("mDevice").hidden = true;

  let justMade = false;
  try { justMade = sessionStorage.getItem("tree-created") === TREE; if (justMade) sessionStorage.removeItem("tree-created"); } catch (e) {}
  if (justMade) { $("mShare").classList.add("new"); $("mShareLead").textContent = "트리를 만들었어요! 이 링크를 친구들에게 보내면 장식을 걸어줄 수 있어요."; }

  $("renameBtn").onclick = async () => {
    const t = $("renameInput").value.trim();
    if (!t) return toast("트리 이름을 적어주세요.");
    $("renameBtn").disabled = true;
    try { const d = await call("PATCH", "/api/trees" + Q, { title: t }); treeTitle = ""; applyTitle(d.title); $("title").textContent = d.title + " 관리"; toast("이름을 바꿨어요.", true); }
    catch (e) { toast(e.message); }
    finally { $("renameBtn").disabled = false; }
  };
  $("delTree").onclick = () => { $("delTree").hidden = true; $("delConfirm").hidden = false; };
  $("delNo").onclick = () => { $("delTree").hidden = false; $("delConfirm").hidden = true; };
  $("delYes").onclick = async () => {
    $("delYes").disabled = true;
    try {
      await call("DELETE", "/api/trees" + Q);
      delete owners[TREE]; saveOwners();
      location.href = ADMIN && !MY_TREE ? "/admin" : "/";
    } catch (e) { toast(e.message); $("delYes").disabled = false; }
  };
  await loadManage();
}
async function loadManage() {
  let d;
  try { d = await call("GET", "/api/tree" + Q + "&m=" + Date.now()); }
  catch (e) {
    if (e.status === 404) { showNotFound(); return; }
    return toast(e.message);
  }
  treeTitle = ""; applyTitle(d.title);
  $("title").textContent = (d.title || "트리") + " 관리";
  const list = (Array.isArray(d.items) ? d.items : []).map(cleanItem).filter(Boolean).sort((a, b) => b.at - a.at);
  $("subtitle").textContent = `장식 ${list.length}개 · 쪽지 ${list.filter((o) => o.note).length}개`;
  $("mOrnTitle").textContent = `걸린 장식 ${list.length}개`;
  $("mEmpty").hidden = list.length > 0;
  const ul = $("mOrns");
  ul.textContent = "";
  for (const o of list) {
    const li = document.createElement("li");
    li.innerHTML = `<svg viewBox="-14 -14 28 28" aria-hidden="true">${ornSVG(o, "mg" + o.id)}</svg>`;
    const info = document.createElement("div"), who = document.createElement("b"), note = document.createElement("span"), when = document.createElement("small");
    info.className = "info";
    who.textContent = o.from;
    note.textContent = o.note || "(쪽지 없음)";
    when.textContent = dateText(o.at);
    info.append(who, note, when);
    const b = document.createElement("button");
    b.type = "button"; b.textContent = "떼기";
    b.onclick = async () => {
      b.disabled = true;
      try { await call("DELETE", "/api/tree" + Q + "&id=" + encodeURIComponent(o.id)); li.remove(); toast("장식을 뗐어요.", true); loadManage(); }
      catch (e) { b.disabled = false; toast(e.message); }
    };
    li.append(info, b);
    ul.append(li);
  }
}

/* ---------- 관리자 페이지 (/admin) ---------- */
function setupAdmin() {
  showPage("adminView", "관리자", "모든 트리를 보고, 관리가 필요한 트리를 정리할 수 있어요.");
  $("headBtns").textContent = "";
  $("headBtns").append(headLink("시작 화면", "/"));
  $("aForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const k = $("aKey").value.normalize("NFC").trim();
    if (!k) return;
    store.set("tree-admin", k);
    location.reload();
  });
  $("aLogout").onclick = () => { store.del("tree-admin"); location.reload(); };
  if (!ADMIN) { $("aLogin").hidden = false; return; }
  $("aList").hidden = false;
  loadAdmin();
}
let adminTrees = [];
async function loadAdmin() {
  try { adminTrees = (await call("GET", "/api/trees")).trees || []; }
  catch (e) {
    if (e.status === 403 || e.status === 503) {
      store.del("tree-admin"); $("aList").hidden = true; $("aLogin").hidden = false;
      $("aMsg").textContent = e.status === 403 ? "관리자 키가 맞지 않아요. Vercel에서 값을 바꿨다면 Redeploy까지 했는지 확인해 주세요." : e.message;
      return;
    }
    return toast(e.message);
  }
  renderAdmin();
}
function renderAdmin() {
  const q = $("aSearch").value.trim().toLowerCase();
  const list = adminTrees.filter((t) => !q || t.id.includes(q) || (t.title || "").toLowerCase().includes(q));
  $("aTitle").textContent = `모든 트리 ${adminTrees.length}개`;
  const ul = $("aTrees");
  ul.textContent = "";
  for (const t of list) {
    const li = document.createElement("li"), info = document.createElement("div"), name = document.createElement("a"), meta = document.createElement("small");
    info.className = "info";
    const legacy = t.id === "main"; // 예전 첫 트리: 이제 주소가 없어요. 지워도 돼요
    if (!legacy) name.href = treePath(t.id);
    name.textContent = legacy ? "예전 첫 트리 (이제 안 보여요)" : t.title || "(이름 없음)";
    meta.textContent = `${legacy ? "trees/main" : "/t/" + t.id} · 장식 ${t.count} · 쪽지 ${t.notes} · 마지막 ${dateText(t.lastAt || t.createdAt)}`;
    info.append(name, meta);
    const acts = document.createElement("div");
    acts.className = "acts";
    if (!legacy) {
      const manage = headLink("관리", managePath(t.id));
      manage.className = "tool";
      acts.append(manage);
    }
    {
      const del = document.createElement("button");
      del.type = "button"; del.className = "tool danger"; del.textContent = "삭제";
      del.onclick = async () => {
        if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "정말 삭제"; setTimeout(() => { del.dataset.armed = ""; del.textContent = "삭제"; }, 4000); return; }
        del.disabled = true;
        try { await call("DELETE", "/api/trees?t=" + t.id); adminTrees = adminTrees.filter((x) => x.id !== t.id); renderAdmin(); toast("트리를 삭제했어요.", true); }
        catch (e) { del.disabled = false; toast(e.message); }
      };
      acts.append(del);
    }
    li.append(info, acts);
    ul.append(li);
  }
}

/* ---------- 트리 만들기 화면 (/new), 없는 트리 ---------- */
function renderMyTrees() {
  const list = myTrees();
  $("myTreesWrap").hidden = !list.length;
  const ul = $("myTrees");
  ul.textContent = "";
  for (const t of list) {
    const li = document.createElement("li"), a = document.createElement("a"), sp = document.createElement("span");
    a.href = treePath(t.id);
    a.textContent = t.title;
    sp.textContent = "/t/" + t.id;
    a.append(sp); li.append(a); ul.append(li);
  }
}
function setupCreate() {
  const has = myTrees().length > 0;
  showPage("createView", "크리스마스 트리", has ? "내 트리로 가거나, 새 트리를 하나 더 만들 수 있어요." : "친구들이 장식을 걸어주는 나만의 트리를 만들어요.");
  $("headBtns").textContent = "";
  if (ADMIN) $("headBtns").append(headLink("관리자", "/admin"));
  if (has) {
    $("createTitle").textContent = "내 트리";
    $("createLead").textContent = "누르면 내 트리로 가요.";
    $("myTreesHead").hidden = true;
    $("newHead").hidden = false;
  }
  renderMyTrees();
  setupCreateForm();
}
function showNotFound() {
  if (WIDGET) { $("loadnote").hidden = true; return; }
  showPage("createView", "트리를 찾지 못했어요", "주소가 잘못됐거나 없어진 트리예요.");
  $("headBtns").textContent = "";
  $("badge").hidden = true;
  $("createTitle").textContent = "내 트리 만들기";
  $("createLead").textContent = "대신 나만의 트리를 만들어 볼까요? 이름만 정하면 바로 만들어져요.";
  renderMyTrees();
  if (!showNotFound.bound) { showNotFound.bound = true; setupCreateForm(); }
}
function setupCreateForm() {
  const msg = (t) => { $("createMsg").textContent = t; };
  $("createForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("newTitle").value.trim();
    if (!title) { $("newTitle").focus(); return msg("트리 이름을 적어주세요."); }
    $("createBtn").disabled = true;
    try {
      const d = await call("POST", "/api/trees", { title });
      owners[d.id] = { token: d.ownerToken, title: d.title };
      saveOwners();
      try { sessionStorage.setItem("tree-created", d.id); } catch (_) {}
      location.href = managePath(d.id);
    } catch (err) { msg(err.message); $("createBtn").disabled = false; }
  });
}

if (WIDGET && !ROUTE) {
  const n = document.createElement("div");
  n.className = "widgetnote";
  n.textContent = "트리 주소를 다시 넣어 주세요.\n작업 표시줄 트리 아이콘 오른쪽 클릭 → 사이트 주소 바꾸기 → 내 트리 주소(…/t/코드)";
  document.body.append(n);
  $("loadnote").hidden = true;
} else if (CREATE) setupCreate();
else if (ADMIN_PAGE) setupAdmin();
else if (UNKNOWN) showNotFound();
else if (MANAGE) setupManage();
else {
  buildTree();
  if (WIDGET) setupWidget(); else { setupHeader(); setupPanel(); }
  requestAnimationFrame(() => { resize(); tick(); });
  refresh();
  setInterval(() => { if (!stopped && (WIDGET || !document.hidden)) refresh(); }, WIDGET ? 15000 : 10000);
  document.addEventListener("visibilitychange", () => { if (!stopped && !document.hidden) refresh(); });
}
if (!WIDGET) $("aSearch")?.addEventListener("input", renderAdmin);
}
