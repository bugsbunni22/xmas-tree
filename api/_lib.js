// 공용 도구: 응답, 키, 속도 제한, 장식 검사
import { createHash } from "node:crypto";

export const TYPES = ["ball", "star", "bell", "candy", "gift", "heart", "flake", "sock"];
export const PATTERNS = ["none", "stripe", "dot", "zigzag", "star", "check"];
export const MAX_PER_PERSON = Number(process.env.MAX_PER_PERSON || 3);
export const MAX_TOTAL = 400;
export const GRID = 16;

export function send(res, status, body, cache = "no-store") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(body));
}

export const hash = (s) => createHash("sha256").update(String(s)).digest("hex");

export function clientKey(req) {
  const k = req.headers["x-tree-key"];
  return typeof k === "string" && k.length >= 16 && k.length <= 100 ? k : null;
}

// 관리자 키: 앞뒤 공백·줄바꿈은 무시하고, 한글은 같은 형태(NFC)로 맞춰서 비교해요.
// 브라우저는 헤더에 한글을 못 실어서 encodeURIComponent 로 보내요.
const normKey = (v) => String(v ?? "").normalize("NFC").trim();
export const adminConfigured = () => !!normKey(process.env.ADMIN_KEY);
export function isAdmin(req) {
  const a = normKey(process.env.ADMIN_KEY);
  let k = req.headers["x-tree-admin"];
  if (!a || typeof k !== "string" || !k) return false;
  try { k = decodeURIComponent(k); } catch {}
  k = normKey(k);
  return k.length > 0 && hash(k) === hash(a);
}

function ip(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
}

// 함수 인스턴스 안에서만 세는 가벼운 속도 제한 (IP당 windowSec초에 max번)
const hits = new Map();
export function limited(name, req, max, windowSec) {
  const k = name + ":" + ip(req), now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowSec * 1000);
  arr.push(now);
  hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

const HEX = /^#[0-9a-f]{6}$/;
const color = (v) => (typeof v === "string" && HEX.test(v.toLowerCase()) ? v.toLowerCase() : null);
const range = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 100) / 100 : null; };

// 장식 디자인 검사 → { design } 또는 { error }
export function checkDesign(b) {
  const kind = b.kind === "drawing" ? "drawing" : "shape";
  const size = range(b.size ?? 1, 0.6, 1.8), rot = range(b.rot ?? 0, -45, 45);
  if (size === null || rot === null) return { error: "크기나 기울기 값이 올바르지 않아요." };
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (Array.from(text).length > 3 || /[\u0000-\u001f<>]/.test(text)) return { error: "글자는 3자까지 새길 수 있어요." };
  const d = { kind, size, rot, text, shine: b.shine === true };
  if (kind === "shape") {
    if (!TYPES.includes(b.type)) return { error: "장식 모양이 올바르지 않아요." };
    const c1 = color(b.c1), c2 = color(b.c2);
    if (!c1 || !c2) return { error: "색이 올바르지 않아요." };
    if (!PATTERNS.includes(b.pattern)) return { error: "무늬가 올바르지 않아요." };
    Object.assign(d, { type: b.type, c1, c2, pattern: b.pattern });
  } else {
    const px = typeof b.px === "string" ? b.px : "";
    if (px.length !== GRID * GRID || !/^[0-8]+$/.test(px) || !/[1-8]/.test(px)) return { error: "그림이 비어 있거나 올바르지 않아요." };
    if (!Array.isArray(b.pal) || b.pal.length !== 8) return { error: "그림 팔레트가 올바르지 않아요." };
    const pal = b.pal.map(color);
    if (pal.some((c) => !c)) return { error: "그림 색이 올바르지 않아요." };
    Object.assign(d, { px, pal });
  }
  return { design: d };
}

// 다른 사람에게 보여줄 때는 owner(비밀 키 해시)를 빼요
export function publicItem(id, o) {
  const { owner, ...rest } = o;
  return { id, ...rest };
}

// 트리 id: "main"(내 첫 트리) 또는 8자 코드
export const TREE_ID = /^(main|[a-z2-9]{8})$/;
// required=true 이면 ?t= 가 꼭 있어야 해요. 없으면 main 으로 새지 않게 null.
export function treeId(req, required = false) {
  const raw = req.query?.t ?? new URL(req.url, "http://x").searchParams.get("t");
  if (raw == null || raw === "") return required ? null : "main";
  const t = String(raw);
  return TREE_ID.test(t) ? t : null;
}
export function queryParam(req, name) {
  return String(req.query?.[name] ?? new URL(req.url, "http://x").searchParams.get(name) ?? "");
}

// 트리 주인: ADMIN_KEY(사이트 관리자) 또는 트리를 만들 때 받은 주인 토큰
export function isTreeOwner(req, tree) {
  if (isAdmin(req)) return true;
  const k = req.headers["x-tree-owner"];
  return typeof k === "string" && k.length >= 16 && k.length <= 100 && !!tree.owner && hash(k) === tree.owner;
}

export function checkTitle(v) {
  const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (Array.from(t).length < 1 || Array.from(t).length > 24 || /[\u0000-\u001f<>]/.test(t)) return null;
  return t;
}
