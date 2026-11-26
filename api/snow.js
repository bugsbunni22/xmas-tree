// POST /api/snow?t=트리  →  1분 동안 함박눈
import { store, dbErrorMessage } from "./_store.js";
import { send, limited, treeId } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "POST만 돼요." }); }
  try {
    const t = treeId(req);
    if (!t) return send(res, 400, { error: "어느 트리인지 알 수 없어요. 페이지를 새로고침한 뒤 다시 해주세요." });
    if (limited("snow", req, 2, 60)) return send(res, 429, { error: "눈은 조금 있다가 다시 뿌려주세요." });
    const snowUntil = Date.now() + 60000;
    if (!(await store().setSnow(t, snowUntil))) return send(res, 404, { error: "트리를 찾지 못했어요." });
    return send(res, 200, { snowUntil });
  } catch (e) {
    console.error(e);
    const msg = dbErrorMessage(e);
    return send(res, msg ? 503 : 500, { error: msg || "눈을 뿌리지 못했어요." });
  }
}
