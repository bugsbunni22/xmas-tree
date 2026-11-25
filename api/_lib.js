// 공용 도구: Redis 연결, 응답, 검사
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";

export const TYPES = ["ball", "star", "bell", "candy", "gift", "heart", "flake", "sock"];
export const COLORS = ["#d8323e", "#f3c34d", "#4aa3df", "#f27aa8", "#9b6bd6", "#8fd16a", "#d9dee3", "#ffffff"];
export const MAX_PER_PERSON = Number(process.env.MAX_PER_PERSON || 3);
export const MAX_TOTAL = 500;
export const KEY = "tree:ornaments"; // 해시: id → 장식 JSON, "_snow" → 함박눈 끝나는 시각(ms)

let client = null;
export function redis() {
  if (globalThis.__treeRedis) return globalThis.__treeRedis; // 로컬 테스트용
  if (!client) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("NO_DB");
    client = new Redis({ url, token });
  }
  return client;
}

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

export function isAdmin(req) {
  const a = process.env.ADMIN_KEY;
  const k = req.headers["x-tree-admin"];
  return !!a && typeof k === "string" && k.length > 0 && hash(k) === hash(a);
}

export function ip(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
}

// IP당 window초 동안 max번까지
export async function limited(name, req, max, windowSec) {
  const k = `tree:rl:${name}:${ip(req)}`;
  const n = await redis().incr(k);
  if (n === 1) await redis().expire(k, windowSec);
  return n > max;
}

export function parse(v) {
  if (v && typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return parse(req.body) || {};
  return {};
}
