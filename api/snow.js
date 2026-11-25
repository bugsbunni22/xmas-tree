// POST /api/snow  →  1분 동안 함박눈
import { store } from "./_store.js";
import { send, limited } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "POST만 돼요." }); }
  try {
    if (limited("snow", req, 2, 60)) return send(res, 429, { error: "눈은 조금 있다가 다시 뿌려주세요." });
    const snowUntil = Date.now() + 60000;
    await store().setSnow(snowUntil);
    return send(res, 200, { snowUntil });
  } catch (e) {
    console.error(e);
    return send(res, ["NO_DB", "BAD_CREDENTIALS"].includes(e.message) ? 503 : 500, { error: "눈을 뿌리지 못했어요." });
  }
}
