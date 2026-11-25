// 저장소: Firestore 문서 하나(trees/main)에 장식을 모두 모아 둬요.
//   { orns: { <id>: 장식 }, snowUntil: 숫자 }
// 목록을 볼 때 문서 1개만 읽으면 돼서 Firestore 무료 한도(하루 읽기 5만 회)를 아낄 수 있어요.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const DOC = "trees/main";
let db = null;

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    let sa;
    try { sa = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")); }
    catch { throw new Error("BAD_CREDENTIALS"); }
    if (typeof sa.private_key === "string") sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    return sa;
  }
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: key } = process.env;
  if (projectId && clientEmail && key) return { projectId, clientEmail, privateKey: key.replace(/\\n/g, "\n") };
  throw new Error("NO_DB");
}

function firestore() {
  if (!db) {
    const app = getApps()[0] || initializeApp({ credential: cert(credentials()) });
    db = getFirestore(app);
  }
  return db;
}

const firestoreStore = {
  async read() {
    const snap = await firestore().doc(DOC).get();
    const d = snap.exists ? snap.data() : {};
    return { orns: d.orns || {}, snowUntil: Number(d.snowUntil) || 0 };
  },
  // check(orns) → 오류 문구 또는 null. 통과하면 저장.
  async add(id, item, check) {
    const fs = firestore(), ref = fs.doc(DOC);
    return fs.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const orns = (snap.exists && snap.data().orns) || {};
      const err = check(orns);
      if (err) return err;
      t.set(ref, { orns: { [id]: item } }, { merge: true });
      return null;
    });
  },
  // allow(item) → true면 삭제. 결과: "ok" | "gone" | "denied"
  async remove(id, allow) {
    const fs = firestore(), ref = fs.doc(DOC);
    return fs.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const item = snap.exists ? (snap.data().orns || {})[id] : null;
      if (!item) return "gone";
      if (!allow(item)) return "denied";
      t.update(ref, { [`orns.${id}`]: FieldValue.delete() });
      return "ok";
    });
  },
  async setSnow(until) {
    await firestore().doc(DOC).set({ snowUntil: until }, { merge: true });
  }
};

export function store() {
  return globalThis.__treeStore || firestoreStore; // 로컬 테스트 때는 메모리 저장소
}
