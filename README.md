# 크리스마스 트리 (Vercel)

친구들은 웹사이트에서 장식을 걸고 쪽지를 남겨요. 내 모니터 구석에 떠 있는 트리 위젯에 그 장식이 바로 나타나요.
사이트, API, 저장소를 전부 Vercel 프로젝트 하나에서 관리해요.

```
public/          웹사이트 (index.html, app.js, config.js)
api/tree.js      장식 목록·걸기·떼기  (GET / POST / DELETE)
api/snow.js      눈 뿌리기
widget/          Windows 트리 위젯 소스 (실행 파일은 TreeWidget-win.zip)
dev/server.js    내 컴퓨터에서 미리 보기용 서버
```

## 배포 (처음 한 번)

1. **Vercel에 가져오기**: https://vercel.com/new 에서 GitHub 계정으로 로그인하고, 이 저장소를 **Import**해요.
   Framework Preset은 `Other`로 두고, 설정은 그대로 둔 채 **Deploy**를 눌러요.
2. **저장소 연결**: 배포된 프로젝트에서 **Storage** 탭 → **Create Database** → **Upstash for Redis** (Free) → 이 프로젝트에 Connect.
   그러면 `KV_REST_API_URL`, `KV_REST_API_TOKEN` 환경 변수가 자동으로 들어가요.
3. **관리자 키 (선택)**: **Settings → Environment Variables**에 `ADMIN_KEY` = 나만 아는 아무 문자열을 추가해요.
   한 사람당 장식 개수를 바꾸려면 `MAX_PER_PERSON`도 추가할 수 있어요 (기본 3).
4. **다시 배포**: **Deployments** 탭에서 맨 위 배포의 `⋯` → **Redeploy**를 눌러요. 환경 변수는 다시 배포해야 적용돼요.
5. `https://프로젝트이름.vercel.app` 주소를 친구들에게 보내면 끝이에요.

이후로는 GitHub에 커밋할 때마다 Vercel이 알아서 다시 배포해요.

## 트리 위젯

1. `TreeWidget-win.zip`을 압축 해제하고 `TreeWidget.exe`를 실행해요.
   서명이 없는 프로그램이라 Windows가 "PC 보호" 창을 띄우면 **추가 정보 → 실행**을 누르면 돼요.
2. 처음에 주소를 묻는 창이 뜨면 `https://프로젝트이름.vercel.app`을 넣어요.
3. 트리를 누르면 사이트가 열리고, 장식에 마우스를 올리면 쪽지가 보여요.
4. 작업 표시줄 트레이의 트리 아이콘을 오른쪽 클릭하면 메뉴가 나와요. 드래그로 옮기기(Bongo Cat 옆에 두기), 위치, 크기, 눈 켜기/끄기, 윈도우 시작 시 자동 실행을 바꿀 수 있어요.

## 관리

- **관리자 모드**: `https://프로젝트이름.vercel.app/?admin=ADMIN_KEY값`으로 한 번 들어가면 그 브라우저에 기억돼요.
  오른쪽 아래에 모든 장식 목록이 나오고, 아무 장식이나 뗄 수 있어요.
- 데이터는 Vercel의 Storage 탭 → Upstash 대시보드 → Data Browser의 `tree:ornaments` 해시에서도 볼 수 있어요.
- 사이트 문구는 `public/config.js`에서 바꿔요.
- 쪽지는 사이트를 보는 사람 누구나 읽을 수 있어요.

## 사용량 참고

- 장식 목록은 Vercel CDN에 10초 동안 캐시돼요. 그래서 보는 사람이 많아도 Redis 조회는 10초에 한 번 정도만 일어나요.
- 위젯은 15초마다, 열려 있는 사이트는 10초마다 새 장식을 확인해요.
- 하루 종일 위젯을 켜 둬도 Upstash 무료 한도 안에 들어가도록 맞춰 뒀어요.

## 내 컴퓨터에서 미리 보기

```
npm install
npm run dev        # http://localhost:3000 (메모리 저장, 껐다 켜면 사라짐)
```
