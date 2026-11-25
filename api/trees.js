// POST  /api/trees            새 트리 만들기 { title } → { id, ownerToken }
// PATCH /api/trees?t=트리     트리 이름 바꾸기 { title } (헤더 x-tree-owner: 주인 토큰)
import { randomBytes } from "node:crypto";
import { store, dbErrorMessage } from "./_store.js";
import { send, hash, limited, readBody, checkTitle, treeId, isTreeOwner } from "./_lib.js";

const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789"; // 헷갈리는 글자(i, l, o, 0, 1) 빼기
const newId = () => Array.from(randomBytes(8), (b) => ALPHA[b % ALPHA.length]).join("");

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      if (limited("create", req, 5, 3600)) return send(res, 429, { error: "트리는 한 시간에 5개까지 만들 수 있어요." });
      const title = checkTitle((await readBody(req)).title);
      if (!title) return send(res, 400, { error: "트리 이름을 1~24자로 적어주세요." });
      const ownerToken = randomBytes(24).toString("hex");
      for (let i = 0; i < 5; i++) {
        const id = newId();
        if (id === "main") continue;
        if (await store().create(id, { title, owner: hash(ownerToken), createdAt: Date.now() }))
          return send(res, 201, { id, title, ownerToken });
      }
      return send(res, 500, { error: "트리를 만들지 못했어요. 다시 해주세요." });
    }

    if (req.method === "PATCH") {
      const t = treeId(req);
      if (!t) return send(res, 400, { error: "트리 주소가 올바르지 않아요." });
      const title = checkTitle((await readBody(req)).title);
      if (!title) return send(res, 400, { error: "트리 이름을 1~24자로 적어주세요." });
      const r = await store().rename(t, title, (tree) => isTreeOwner(req, tree));
      if (r === "gone") return send(res, 404, { error: "트리를 찾지 못했어요." });
      if (r === "denied") return send(res, 403, { error: "트리 주인만 이름을 바꿀 수 있어요." });
      return send(res, 200, { title });
    }

    res.setHeader("Allow", "POST, PATCH");
    return send(res, 405, { error: "지원하지 않는 요청이에요." });
  } catch (e) {
    console.error(e);
    const msg = dbErrorMessage(e);
    return send(res, msg ? 503 : 500, { error: msg || "서버 오류가 났어요." });
  }
}
