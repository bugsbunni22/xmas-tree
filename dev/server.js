// 로컬 테스트 서버: node dev/server.js  →  http://localhost:3000
// FIREBASE_SERVICE_ACCOUNT가 없으면 메모리에 저장해요 (껐다 켜면 사라짐).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_PRIVATE_KEY && !process.env.NO_MEMORY) {
  const doc = { orns: {}, snowUntil: 0 };
  globalThis.__treeStore = {
    async read() { return JSON.parse(JSON.stringify(doc)); },
    async add(id, item, check) { const err = check(doc.orns); if (err) return err; doc.orns[id] = item; return null; },
    async remove(id, allow) { const o = doc.orns[id]; if (!o) return "gone"; if (!allow(o)) return "denied"; delete doc.orns[id]; return "ok"; },
    async setSnow(t) { doc.snowUntil = t; }
  };
  console.log("메모리 저장소로 실행 중 (FIREBASE_SERVICE_ACCOUNT가 있으면 Firestore 사용)");
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
