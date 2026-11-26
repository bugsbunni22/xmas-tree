// GET    /api/trees                         모든 트리 목록 (관리자만, 헤더 x-tree-admin)
// POST   /api/trees                         새 트리 만들기 { title, password } → { id, ownerToken }
// POST   /api/trees?action=find             내 트리 찾기 { title, password } → { trees: [{ id, title, ownerToken }] }
// POST   /api/trees?t=트리&action=claim     주인 다시 정하기 (관리자만) → { ownerToken }
// PATCH  /api/trees?t=트리                  이름 { title } 또는 비밀번호 { password } 바꾸기 (주인·관리자)
// DELETE /api/trees?t=트리                  트리 삭제 (주인·관리자)
import { randomBytes } from "node:crypto";
import { store, dbErrorMessage, MAIN } from "./_store.js";
import { send, hash, limited, readBody, checkTitle, treeId, isTreeOwner, isAdmin, adminConfigured, titleKey, checkPassword, hashPassword, verifyPassword } from "./_lib.js";

const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789"; // 헷갈리는 글자(i, l, o, 0, 1) 빼기
const newId = () => Array.from(randomBytes(8), (b) => ALPHA[b % ALPHA.length]).join("");
const newToken = () => randomBytes(24).toString("hex");
const PW_ERROR = "비밀번호는 4자 이상으로 정해주세요.";

export default async function handler(req, res) {
  try {
    const action = new URL(req.url, "http://x").searchParams.get("action");

    if (req.method === "GET") {
      if (!adminConfigured()) return send(res, 503, { error: "서버에 ADMIN_KEY가 아직 없어요. Vercel 환경 변수에 ADMIN_KEY를 저장하고 Redeploy 해주세요." });
      if (!isAdmin(req)) return send(res, 403, { error: "관리자 키가 맞지 않아요." });
      const trees = (await store().list()).sort((a, b) => (b.lastAt || b.createdAt) - (a.lastAt || a.createdAt));
      return send(res, 200, { trees });
    }

    if (req.method === "POST" && action === "find") {
      if (limited("find", req, 10, 600)) return send(res, 429, { error: "너무 여러 번 시도했어요. 10분 뒤에 다시 해주세요." });
      const b = await readBody(req);
      const title = checkTitle(b.title), password = checkPassword(b.password);
      if (!title || !password) return send(res, 404, { error: "이 이름과 비밀번호로 된 트리가 없어요.", notFound: true });
      const found = (await store().findByTitle(titleKey(title))).filter((t) => verifyPassword(password, t.pw)).sort((a, z) => z.createdAt - a.createdAt);
      if (!found.length) return send(res, 404, { error: "이 이름과 비밀번호로 된 트리가 없어요.", notFound: true });
      const trees = [];
      for (const t of found.slice(0, 5)) {
        const ownerToken = newToken();
        if ((await store().addOwner(t.id, hash(ownerToken))) === "ok") trees.push({ id: t.id, title: t.title, ownerToken });
      }
      return send(res, 200, { trees });
    }

    if (req.method === "POST" && action === "claim") {
      if (!isAdmin(req)) return send(res, 403, { error: "관리자만 주인을 다시 정할 수 있어요." });
      const t = treeId(req);
      if (!t || t === MAIN) return send(res, 400, { error: "어느 트리인지 알 수 없어요." });
      const ownerToken = newToken();
      const r = await store().setOwner(t, hash(ownerToken));
      if (r === "gone") return send(res, 404, { error: "트리를 찾지 못했어요." });
      return send(res, 200, { id: t, ownerToken });
    }

    if (req.method === "POST") {
      if (limited("create", req, 5, 3600)) return send(res, 429, { error: "트리는 한 시간에 5개까지 만들 수 있어요." });
      const b = await readBody(req);
      const title = checkTitle(b.title);
      if (!title) return send(res, 400, { error: "트리 이름을 1~24자로 적어주세요." });
      const password = checkPassword(b.password);
      if (!password) return send(res, 400, { error: PW_ERROR });
      const ownerToken = newToken(), pw = hashPassword(password);
      for (let i = 0; i < 5; i++) {
        const id = newId();
        if (id === MAIN) continue;
        if (await store().create(id, { title, titleKey: titleKey(title), pw, owner: hash(ownerToken), createdAt: Date.now() }))
          return send(res, 201, { id, title, ownerToken });
      }
      return send(res, 500, { error: "트리를 만들지 못했어요. 다시 해주세요." });
    }

    const t = treeId(req);
    if (!t) return send(res, 400, { error: "어느 트리인지 알 수 없어요." });

    if (req.method === "PATCH") {
      const b = await readBody(req);
      if (b.password !== undefined) {
        const password = checkPassword(b.password);
        if (!password) return send(res, 400, { error: PW_ERROR });
        const tree = await store().read(t);
        if (!tree.exists) return send(res, 404, { error: "트리를 찾지 못했어요." });
        const r = await store().setPassword(t, hashPassword(password), titleKey(tree.title), (m) => isTreeOwner(req, m));
        if (r === "gone") return send(res, 404, { error: "트리를 찾지 못했어요." });
        if (r === "denied") return send(res, 403, { error: "트리 주인만 비밀번호를 바꿀 수 있어요." });
        return send(res, 200, { ok: true });
      }
      const title = checkTitle(b.title);
      if (!title) return send(res, 400, { error: "트리 이름을 1~24자로 적어주세요." });
      const r = await store().rename(t, title, titleKey(title), (tree) => isTreeOwner(req, tree));
      if (r === "gone") return send(res, 404, { error: "트리를 찾지 못했어요." });
      if (r === "denied") return send(res, 403, { error: "트리 주인만 이름을 바꿀 수 있어요." });
      return send(res, 200, { title });
    }

    if (req.method === "DELETE") {
      const r = await store().removeTree(t, (tree) => isTreeOwner(req, tree));
      if (r === "denied") return send(res, 403, { error: "트리 주인만 지울 수 있어요." });
      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return send(res, 405, { error: "지원하지 않는 요청이에요." });
  } catch (e) {
    console.error(e);
    const msg = dbErrorMessage(e);
    return send(res, msg ? 503 : 500, { error: msg || "서버 오류가 났어요." });
  }
}
