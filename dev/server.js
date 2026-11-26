// 로컬 테스트 서버: node dev/server.js  →  http://localhost:3000
// FIREBASE_SERVICE_ACCOUNT가 없으면 메모리에 저장해요 (껐다 켜면 사라짐).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_PRIVATE_KEY && !process.env.NO_MEMORY) {
  const trees = new Map([["main", { title: "", owner: "", orns: {}, snowUntil: 0 }]]);
  const get = (t) => trees.get(t);
  globalThis.__treeStore = {
    async read(t) { const d = get(t); return d ? { exists: true, ...JSON.parse(JSON.stringify(d)) } : { exists: false, title: "", owner: "", orns: {}, snowUntil: 0 }; },
    async add(t, id, item, check) { const d = get(t); if (!d) return "트리를 찾지 못했어요."; const err = check(d); if (err) return err; d.orns[id] = item; return null; },
    async remove(t, id, allow) { const d = get(t); const o = d && d.orns[id]; if (!o) return "gone"; if (!allow(o, d)) return "denied"; delete d.orns[id]; return "ok"; },
    async setSnow(t, u) { const d = get(t); if (!d) return false; d.snowUntil = u; return true; },
    async create(t, data) { if (trees.has(t)) return false; trees.set(t, { ...data, orns: {}, snowUntil: 0 }); return true; },
    async rename(t, title, allow) { const d = get(t); if (!d) return "gone"; if (!allow(d)) return "denied"; d.title = title; return "ok"; },
    async setOwner(t, owner) { const d = get(t); if (!d) return "gone"; d.owner = owner; return "ok"; },
    async list() { const { summarize } = await import("../api/_store.js"); return [...trees].map(([id, d]) => summarize(id, d)); },
    async removeTree(t, allow) { const d = get(t); if (!d) return "gone"; if (!allow(d)) return "denied"; trees.delete(t); return "ok"; }
  };
  console.log("메모리 저장소로 실행 중 (FIREBASE_SERVICE_ACCOUNT가 있으면 Firestore 사용)");
}
const routes = { "/api/tree": "../api/tree.js", "/api/snow": "../api/snow.js", "/api/trees": "../api/trees.js" };
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
  const page = ["/", "/new", "/admin"].includes(url.pathname) || /^\/t\/[^/]+(\/manage)?$/.test(url.pathname); // vercel.json rewrites와 같게
  const file = path.join(root, "public", page ? "index.html" : url.pathname);
  if (!file.startsWith(path.join(root, "public")) || !fs.existsSync(file)) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
