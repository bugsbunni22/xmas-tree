// 로컬 테스트 서버: node dev/server.js  →  http://localhost:3000
// KV_REST_API_URL이 없으면 메모리에 저장해요 (껐다 켜면 사라짐).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
  const h = new Map(), kv = new Map();
  globalThis.__treeRedis = {
    async hgetall(k) { const m = h.get(k); return m && m.size ? Object.fromEntries(m) : null; },
    async hget(k, f) { return h.get(k)?.get(f) ?? null; },
    async hset(k, obj) { if (!h.has(k)) h.set(k, new Map()); for (const [f, v] of Object.entries(obj)) h.get(k).set(f, v); return 1; },
    async hdel(k, f) { return h.get(k)?.delete(f) ? 1 : 0; },
    async incr(k) { const n = (kv.get(k) || 0) + 1; kv.set(k, n); return n; },
    async expire(k, s) { setTimeout(() => kv.delete(k), s * 1000).unref(); return 1; }
  };
  console.log("메모리 저장소로 실행 중");
}
const routes = { "/api/tree": "../api/tree.js", "/api/snow": "../api/snow.js" };
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (routes[url.pathname]) {
    let raw = "";
    for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    req.query = Object.fromEntries(url.searchParams);
    const mod = await import(routes[url.pathname]);
    return mod.default(req, res);
  }
  const file = path.join(root, "public", url.pathname === "/" ? "index.html" : url.pathname);
  if (!file.startsWith(path.join(root, "public")) || !fs.existsSync(file)) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
