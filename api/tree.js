// GET    /api/tree          장식 목록 + 함박눈 상태 (10초 CDN 캐시)
// POST   /api/tree          장식 걸기   (헤더 x-tree-key: 브라우저마다 만든 비밀 키)
// DELETE /api/tree?id=...   장식 떼기   (건 사람의 키, 또는 x-tree-admin: ADMIN_KEY)
import { randomUUID } from "node:crypto";
import { TYPES, COLORS, MAX_PER_PERSON, MAX_TOTAL, KEY, redis, send, hash, clientKey, isAdmin, limited, parse, readBody } from "./_lib.js";

function publicItem(id, o) {
  return { id, type: o.type, color: o.color, x: o.x, y: o.y, from: o.from, note: o.note, at: o.at };
}

export default async function handler(req, res) {
  try {
    const db = redis();

    if (req.method === "GET") {
      const all = (await db.hgetall(KEY)) || {};
      const items = [];
      let snowUntil = 0;
      for (const [id, v] of Object.entries(all)) {
        if (id === "_snow") { snowUntil = Number(v) || 0; continue; }
        const o = parse(v);
        if (o) items.push(publicItem(id, o));
      }
      items.sort((a, b) => a.at - b.at);
      return send(res, 200, { items, snowUntil, now: Date.now() }, "public, s-maxage=10, stale-while-revalidate=20");
    }

    if (req.method === "POST") {
      const key = clientKey(req);
      if (!key) return send(res, 400, { error: "키가 없어요." });
      if (await limited("post", req, 10, 60)) return send(res, 429, { error: "너무 빨라요. 잠시 뒤에 다시 걸어주세요." });
      const b = await readBody(req);
      const x = Number(b.x), y = Number(b.y);
      const from = typeof b.from === "string" ? b.from.trim() : "";
      const note = typeof b.note === "string" ? b.note.trim() : "";
      if (!TYPES.includes(b.type) || !COLORS.includes(b.color)) return send(res, 400, { error: "장식 종류나 색이 올바르지 않아요." });
      if (!(x >= 0 && x <= 200 && y >= 0 && y <= 262)) return send(res, 400, { error: "트리 위를 눌러 자리를 정해주세요." });
      if (from.length < 1 || from.length > 20) return send(res, 400, { error: "이름은 1~20자로 적어주세요." });
      if (note.length > 200) return send(res, 400, { error: "쪽지는 200자까지예요." });

      const owner = hash(key);
      const all = (await db.hgetall(KEY)) || {};
      let mine = 0, total = 0;
      for (const [id, v] of Object.entries(all)) {
        if (id === "_snow") continue;
        total++;
        if (parse(v)?.owner === owner) mine++;
      }
      if (total >= MAX_TOTAL) return send(res, 409, { error: "트리가 장식으로 꽉 찼어요!" });
      if (mine >= MAX_PER_PERSON) return send(res, 409, { error: `한 사람당 ${MAX_PER_PERSON}개까지 걸 수 있어요. 하나 떼고 다시 걸어주세요.` });

      const id = randomUUID().slice(0, 12);
      const item = { type: b.type, color: b.color, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, from, note, at: Date.now(), owner };
      await db.hset(KEY, { [id]: JSON.stringify(item) });
      return send(res, 201, { item: publicItem(id, item) });
    }

    if (req.method === "DELETE") {
      const id = String(req.query?.id ?? new URL(req.url, "http://x").searchParams.get("id") ?? "");
      if (!/^[0-9a-f-]{6,40}$/.test(id)) return send(res, 400, { error: "잘못된 장식이에요." });
      const v = parse(await db.hget(KEY, id));
      if (!v) return send(res, 200, { ok: true });
      const key = clientKey(req);
      if (!isAdmin(req) && !(key && hash(key) === v.owner)) return send(res, 403, { error: "내가 건 장식만 뗄 수 있어요." });
      await db.hdel(KEY, id);
      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "지원하지 않는 요청이에요." });
  } catch (e) {
    console.error(e);
    if (e.message === "NO_DB") return send(res, 503, { error: "저장소가 아직 연결되지 않았어요. Vercel에서 Upstash Redis를 연결해주세요." });
    return send(res, 500, { error: "서버 오류가 났어요." });
  }
}
