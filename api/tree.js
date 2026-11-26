// GET    /api/tree?t=트리          장식 목록 + 트리 이름 + 함박눈 상태 (10초 CDN 캐시)
// POST   /api/tree?t=트리          장식 걸기   (헤더 x-tree-key: 브라우저마다 만든 비밀 키)
// DELETE /api/tree?t=트리&id=...   장식 떼기   (건 사람의 키, 트리 주인 토큰, 또는 ADMIN_KEY)
import { randomUUID } from "node:crypto";
import { store, dbErrorMessage } from "./_store.js";
import { MAX_PER_PERSON, MAX_TOTAL, send, hash, clientKey, isTreeOwner, limited, readBody, checkDesign, publicItem, treeId, queryParam } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const t = treeId(req); // 트리 코드가 꼭 있어야 해요
    if (!t) return send(res, 400, { error: "어느 트리인지 알 수 없어요. 페이지를 새로고침한 뒤 다시 해주세요." });

    if (req.method === "GET") {
      const tree = await store().read(t);
      if (!tree.exists) return send(res, 404, { error: "트리를 찾지 못했어요. 주소를 다시 확인해주세요." }, "public, s-maxage=10");
      const items = Object.entries(tree.orns).map(([id, o]) => publicItem(id, o)).sort((a, b) => a.at - b.at);
      return send(res, 200, { tree: t, title: tree.title, items, snowUntil: tree.snowUntil, now: Date.now() }, "public, s-maxage=10, stale-while-revalidate=20");
    }

    if (req.method === "POST") {
      const key = clientKey(req);
      if (!key) return send(res, 400, { error: "키가 없어요. 새로고침 후 다시 해주세요." });
      if (limited("post", req, 10, 60)) return send(res, 429, { error: "너무 빨라요. 잠시 뒤에 다시 걸어주세요." });
      const b = await readBody(req);
      const { design, error } = checkDesign(b);
      if (error) return send(res, 400, { error });
      const x = Number(b.x), y = Number(b.y);
      const from = typeof b.from === "string" ? b.from.trim() : "";
      const note = typeof b.note === "string" ? b.note.trim() : "";
      if (!(x >= 0 && x <= 200 && y >= 0 && y <= 262)) return send(res, 400, { error: "트리 위를 눌러 자리를 정해주세요." });
      if (from.length < 1 || from.length > 20) return send(res, 400, { error: "이름은 1~20자로 적어주세요." });
      if (note.length > 200) return send(res, 400, { error: "쪽지는 200자까지예요." });

      const owner = hash(key);
      const id = randomUUID().replace(/-/g, "").slice(0, 12);
      const item = { ...design, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, from, note, at: Date.now(), owner };
      const err = await store().add(t, id, item, (tree) => {
        const all = Object.values(tree.orns);
        if (all.length >= MAX_TOTAL) return "트리가 장식으로 꽉 찼어요!";
        if (!isTreeOwner(req, tree) && all.filter((o) => o.owner === owner).length >= MAX_PER_PERSON)
          return `한 사람당 ${MAX_PER_PERSON}개까지 걸 수 있어요. 하나 떼고 다시 걸어주세요.`;
        return null;
      });
      if (err) return send(res, err.startsWith("트리를 찾지") ? 404 : 409, { error: err });
      return send(res, 201, { item: publicItem(id, item) });
    }

    if (req.method === "DELETE") {
      const id = queryParam(req, "id");
      if (!/^[0-9a-f]{12}$/.test(id)) return send(res, 400, { error: "잘못된 장식이에요." });
      const key = clientKey(req), mine = key ? hash(key) : null;
      const r = await store().remove(t, id, (o, tree) => isTreeOwner(req, tree) || (mine && o.owner === mine));
      if (r === "denied") return send(res, 403, { error: "내가 건 장식만 뗄 수 있어요." });
      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "지원하지 않는 요청이에요." });
  } catch (e) {
    console.error(e);
    const msg = dbErrorMessage(e);
    if (msg) return send(res, 503, { error: msg });
    return send(res, 500, { error: "서버 오류가 났어요." });
  }
}
