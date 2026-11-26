// 저장소: 트리마다 Firestore 문서 하나(trees/<트리 id>)에 장식을 모두 모아 둬요.
//   { title, owner(주인 토큰 해시), createdAt, orns: { <id>: 장식 }, snowUntil }
// 목록을 볼 때 문서 1개만 읽으면 돼서 Firestore 무료 한도(하루 읽기 5만 회)를 아낄 수 있어요.
// "main" 은 예전 첫 트리 id 예요. 이제 특별 취급하지 않고, 관리자가 목록에서 지울 수 있어요.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const MAIN = "main";
let db = null;

// 붙여넣기 실수(앞뒤 따옴표, 공백, 문자열로 한 번 더 감싼 JSON, base64)를 너그럽게 받아줘요
function parseServiceAccount(raw) {
  let s = raw.trim();
  if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1).trim();
  let v;
  try { v = JSON.parse(s.startsWith("{") || s.startsWith('"') ? s : Buffer.from(s, "base64").toString("utf8")); }
  catch { throw new Error("BAD_JSON"); }
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { throw new Error("BAD_JSON"); } }
  if (!v || typeof v !== "object") throw new Error("BAD_JSON");
  if (v.apiKey || v.authDomain) throw new Error("WEB_CONFIG");
  if (typeof v.private_key !== "string" || typeof v.client_email !== "string" || typeof v.project_id !== "string") throw new Error("NOT_SERVICE_ACCOUNT");
  v.private_key = v.private_key.replace(/\\n/g, "\n");
  return v;
}

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim()) return parseServiceAccount(raw);
  if (raw !== undefined) throw new Error("EMPTY");
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: key } = process.env;
  if (projectId && clientEmail && key) return { projectId, clientEmail, privateKey: key.replace(/\\n/g, "\n") };
  throw new Error("NO_DB");
}

// 저장소 연결 문제를 사람이 읽을 수 있는 문구로 (해당 없으면 null)
export function dbErrorMessage(e) {
  const near = Object.keys(process.env).filter((k) => k !== "FIREBASE_SERVICE_ACCOUNT" && /FIREBASE|SERVICE_ACCOUNT/i.test(k));
  switch (e && e.message) {
    case "NO_DB":
      return near.length
        ? `FIREBASE_SERVICE_ACCOUNT 환경 변수를 찾지 못했어요. 비슷한 이름(${near.join(", ")})만 있어요. 이름을 정확히 FIREBASE_SERVICE_ACCOUNT로 바꿔주세요.`
        : "Vercel에 FIREBASE_SERVICE_ACCOUNT 환경 변수가 없어요. 저장한 뒤 Redeploy를 했는지, Production 환경에 체크했는지 확인해주세요.";
    case "EMPTY": return "FIREBASE_SERVICE_ACCOUNT는 있는데 값이 비어 있어요. Edit 화면에서 빈 칸인 채로 저장하면 비워져요. JSON 내용 전체를 다시 붙여넣고 저장한 뒤 Redeploy 해주세요.";
    case "BAD_JSON": return "FIREBASE_SERVICE_ACCOUNT 값이 JSON 형식이 아니에요. 서비스 계정 JSON 파일 내용 전체({ 부터 } 까지)를 그대로 붙여넣어 주세요.";
    case "WEB_CONFIG": return "FIREBASE_SERVICE_ACCOUNT에 웹 앱 설정(apiKey)이 들어가 있어요. 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성으로 받은 JSON을 넣어주세요.";
    case "NOT_SERVICE_ACCOUNT": return "FIREBASE_SERVICE_ACCOUNT 값에 private_key, client_email, project_id가 없어요. 서비스 계정 JSON 파일 내용 전체를 넣어주세요.";
    default: break;
  }
  if (/private key|Certificate object|Service account object/i.test(String(e && e.message)))
    return "서비스 계정 키(private_key) 형식이 올바르지 않아요. JSON 파일을 메모장으로 열어 내용 전체를 고치지 말고 그대로 붙여넣어 주세요.";
  const code = e && (e.code ?? e.errorInfo?.code);
  const text = String(e && (e.details || e.message) || "");
  if (/has not been used|is disabled|SERVICE_DISABLED|API has not been/i.test(text))
    return "Firestore가 아직 켜져 있지 않아요. Firebase 콘솔 → 빌드 → Firestore Database → 데이터베이스 만들기(서울, 프로덕션 모드)를 해주세요. 만든 뒤 몇 분 지나면 연결돼요.";
  if (code === 7 || code === "permission-denied" || /PERMISSION_DENIED/.test(text))
    return "Firestore에 접근할 수 없어요. ① Firebase 콘솔에서 Firestore Database를 만들었는지, ② 서비스 계정 JSON이 같은 프로젝트 것인지 확인해주세요.";
  if (code === 5 || code === "not-found" || /NOT_FOUND/.test(text))
    return "Firestore 데이터베이스를 찾지 못했어요. Firebase 콘솔에서 Firestore Database를 만들었는지 확인해주세요.";
  if (code === 16 || /UNAUTHENTICATED|invalid_grant/i.test(text))
    return "서비스 계정 키가 유효하지 않아요. 키를 새로 생성해서 다시 넣어주세요.";
  return null;
}

function firestore() {
  if (!db) {
    const app = getApps()[0] || initializeApp({ credential: cert(credentials()) });
    db = getFirestore(app);
  }
  return db;
}
const ref = (t) => firestore().doc(`trees/${t}`);

// 주인 확인에 쓰는 트리 정보 (장식 목록은 빼고)
//   owner: 처음 만든 브라우저의 토큰 해시, owners: 비밀번호로 찾은 브라우저들의 토큰 해시
const meta = (d) => ({ owner: d.owner || "", owners: Array.isArray(d.owners) ? d.owners : [], title: d.title || "", pw: d.pw || "" });
const MAX_OWNERS = 10;

const firestoreStore = {
  // { exists, title, owner, owners, pw, orns, snowUntil }
  async read(t) {
    const snap = await ref(t).get();
    const d = snap.exists ? snap.data() : {};
    return { exists: snap.exists, ...meta(d), orns: d.orns || {}, snowUntil: Number(d.snowUntil) || 0 };
  },
  // check(tree) → 오류 문구 또는 null. 통과하면 장식 저장.
  async add(t, id, item, check) {
    const fs = firestore(), r = ref(t);
    return fs.runTransaction(async (tx) => {
      const snap = await tx.get(r);
      if (!snap.exists) return "트리를 찾지 못했어요.";
      const d = snap.data();
      const err = check({ ...meta(d), orns: d.orns || {} });
      if (err) return err;
      tx.set(r, { orns: { [id]: item } }, { merge: true });
      return null;
    });
  },
  // allow(item, tree) → true면 삭제. 결과: "ok" | "gone" | "denied"
  async remove(t, id, allow) {
    const fs = firestore(), r = ref(t);
    return fs.runTransaction(async (tx) => {
      const snap = await tx.get(r);
      const d = snap.exists ? snap.data() : {};
      const item = (d.orns || {})[id];
      if (!item) return "gone";
      if (!allow(item, meta(d))) return "denied";
      tx.update(r, { [`orns.${id}`]: FieldValue.delete() });
      return "ok";
    });
  },
  async setSnow(t, until) {
    const fs = firestore(), r = ref(t);
    return fs.runTransaction(async (tx) => {
      const snap = await tx.get(r);
      if (!snap.exists) return false;
      tx.set(r, { snowUntil: until }, { merge: true });
      return true;
    });
  },
  // 새 트리. 이미 있으면 false
  async create(t, data) {
    try { await ref(t).create({ ...data, owners: [], orns: {}, snowUntil: 0 }); return true; }
    catch (e) { if (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message))) return false; throw e; }
  },
  // 관리자용: 모든 트리 요약 (트리 수만큼 읽기가 들어가요)
  async list() {
    const snap = await firestore().collection("trees").get();
    return snap.docs.map((d) => summarize(d.id, d.data()));
  },
  // 이름으로 찾기: 이름이 같은 트리들의 { id, title, pw } (비밀번호 확인은 호출한 쪽에서)
  async findByTitle(titleKey) {
    const snap = await firestore().collection("trees").where("titleKey", "==", titleKey).limit(20).get();
    return snap.docs.map((d) => ({ id: d.id, title: d.data().title || "", pw: d.data().pw || "", createdAt: Number(d.data().createdAt) || 0 }));
  },
  // 비밀번호로 찾은 브라우저를 주인으로 추가 (최근 10개까지)
  async addOwner(t, ownerHash) {
    const fs = firestore(), r = ref(t);
    return fs.runTransaction(async (tx) => {
      const snap = await tx.get(r);
      if (!snap.exists) return "gone";
      const owners = meta(snap.data()).owners.filter((h) => h !== ownerHash).concat(ownerHash).slice(-MAX_OWNERS);
      tx.update(r, { owners });
      return "ok";
    });
  },
  // 트리 비밀번호 정하기. 결과: "ok" | "gone" | "denied"
  async setPassword(t, pwHash, titleKey, allow) {
    const fs = firestore(), r = ref(t);
    return fs.runTransaction(async (tx) => {
      const snap = await tx.get(r);
      if (!snap.exists) return "gone";
      if (!allow(meta(snap.data()))) return "denied";
      tx.update(r, { pw: pwHash, titleKey });
      return "ok";
    });
  },
  // allow(tree) → true면 트리 통째로 삭제. 결과: "ok" | "gone" | "denied"
  async removeTree(t, allow) {
    const fs = firestore(), r = ref(t);
    return fs.runTransaction(async (tx) => {
      const snap = await tx.get(r);
      if (!snap.exists) return "gone";
      if (!allow(meta(snap.data()))) return "denied";
      tx.delete(r);
      return "ok";
    });
  },
  // 주인 다시 정하기 (관리자). 예전 주인 토큰·관리 링크·비밀번호로 찾은 브라우저 모두 더 이상 안 돼요. 결과: "ok" | "gone"
  async setOwner(t, owner) {
    const fs = firestore(), r = ref(t);
    return fs.runTransaction(async (tx) => {
      const snap = await tx.get(r);
      if (!snap.exists) return "gone";
      tx.update(r, { owner, owners: [] });
      return "ok";
    });
  },
  // allow(tree) → true면 이름 바꾸기. 결과: "ok" | "gone" | "denied"
  async rename(t, title, titleKey, allow) {
    const fs = firestore(), r = ref(t);
    return fs.runTransaction(async (tx) => {
      const snap = await tx.get(r);
      if (!snap.exists) return "gone";
      if (!allow(meta(snap.data()))) return "denied";
      tx.update(r, { title, titleKey });
      return "ok";
    });
  }
};

export function summarize(id, d) {
  const orns = Object.values(d.orns || {});
  return {
    id, title: d.title || "", count: orns.length, hasPassword: !!d.pw,
    notes: orns.filter((o) => o && o.note).length,
    createdAt: Number(d.createdAt) || 0,
    lastAt: orns.reduce((m, o) => Math.max(m, Number(o && o.at) || 0), 0)
  };
}

export function store() {
  return globalThis.__treeStore || firestoreStore; // 로컬 테스트 때는 메모리 저장소
}
