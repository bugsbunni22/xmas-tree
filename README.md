# 크리스마스 트리 (Vercel + Firestore)

친구들은 웹사이트에서 직접 꾸민 장식을 트리에 걸고 쪽지를 남겨요. 내 모니터 구석에 떠 있는 트리 위젯에도 그 장식이 나타나요.

- **사이트와 API**: Vercel
- **저장소**: Firebase Firestore. 브라우저는 직접 접근할 수 없고, Vercel API만 서비스 계정으로 읽고 써요.

```
public/          웹사이트 (index.html, app.js, config.js)
api/tree.js      장식 목록·걸기·떼기  (GET / POST / DELETE)
api/snow.js      눈 뿌리기
api/_store.js    Firestore 읽기·쓰기 (trees/main 문서 하나에 모두 저장)
api/_lib.js      장식 검사, 키, 속도 제한
firestore.rules  브라우저 직접 접근 차단 규칙
widget/          Windows 트리 위젯 소스 (실행 파일은 TreeWidget-win.zip)
dev/server.js    내 컴퓨터에서 미리 보기용 서버
```

## 친구들이 할 수 있는 꾸미기

- **모양 고르기**: 방울, 별, 종, 지팡이 사탕, 선물 상자, 하트, 눈송이, 양말
  - 색을 마음대로 고를 수 있어요 (무지개 버튼).
  - 무늬: 줄무늬, 물방울, 지그재그, 별, 체크
  - 보조 색: 무늬, 리본, 사탕 줄, 양말 목 색
- **직접 그리기**: 16×16 픽셀 그림판
  - 연필, 지우개, 채우기, 좌우 대칭, 되돌리기
  - 물감 8색은 바꿀 수 있어요.
  - 방울·하트·트리 틀에서 시작할 수 있어요.
- **공통**: 글자 새기기(3자까지), 크기 60~180%, 기울기 ±45°, 반짝이 효과

## 1. Firebase 준비 (처음 한 번)

1. https://console.firebase.google.com 에서 **프로젝트 추가**를 눌러요. Google 애널리틱스는 꺼도 돼요.
2. **빌드 → Firestore Database → 데이터베이스 만들기**
   - 위치는 `asia-northeast3 (서울)`, 모드는 **프로덕션 모드**로 해요.
   - **규칙** 탭에 `firestore.rules` 내용을 붙여넣고 **게시**해요. 브라우저에서는 아무것도 못 읽고 못 쓰게 막는 규칙이에요.
3. **서비스 계정 키 만들기**
   - 왼쪽 위 톱니바퀴 → **프로젝트 설정 → 서비스 계정** → **새 비공개 키 생성**을 누르면 JSON 파일이 받아져요.
   - ⚠️ 이 파일은 비밀번호나 마찬가지예요. GitHub에 올리거나 다른 사람에게 보내지 마세요.

## 2. Vercel 설정

1. Vercel 프로젝트의 **Settings → Environment Variables**에 다음을 추가해요.

   | 이름 | 값 |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | 받은 JSON 파일의 내용 **전체**를 그대로 붙여넣기 (Sensitive 체크) |
   | `ADMIN_KEY` | (선택) 나만 아는 아무 문자열. 관리자 모드에 써요 |
   | `MAX_PER_PERSON` | (선택) 한 사람당 장식 개수. 기본 3 |

2. **Deployments** 탭에서 맨 위 배포의 `⋯` → **Redeploy**를 눌러요. 환경 변수는 다시 배포해야 적용돼요.
3. 예전에 Storage 탭에서 Upstash Redis를 연결했다면, 이제 쓰지 않으니 연결을 해제해도 돼요.

이후로는 GitHub에 커밋할 때마다 Vercel이 자동으로 다시 배포해요. API 함수는 Firestore와 가까운 서울 리전(`icn1`)에서 실행돼요.

## 3. 트리 위젯

1. `TreeWidget-win.zip`을 풀고 `TreeWidget.exe`를 실행해요.
   - Windows가 "PC 보호" 창을 띄우면 **추가 정보 → 실행**을 누르면 돼요.
2. 처음에 주소를 묻는 창이 뜨면 `https://프로젝트이름.vercel.app`을 넣어요.
3. 쓰는 법
   - 트리를 누르면 사이트가 열려요.
   - 장식에 마우스를 올리면 쪽지가 보여요.
   - 트레이 아이콘을 오른쪽 클릭하면 메뉴가 나와요: 옮기기, 위치, 크기, 눈, 자동 실행

## 관리

- **관리자 모드**: `https://프로젝트이름.vercel.app/?admin=ADMIN_KEY값`으로 한 번 들어가면 그 브라우저에 기억돼요. 모든 장식 목록이 보이고, 아무 장식이나 뗄 수 있어요.
- **데이터 보기**: Firebase 콘솔 → Firestore → `trees/main` 문서의 `orns` 필드에 장식이 모여 있어요.
- **문구 바꾸기**: `public/config.js`에서 바꿔요.
- 쪽지는 사이트를 보는 사람 누구나 읽을 수 있어요.
- 보내는 사람 이름은 브라우저에 저장하지 않아요. 브라우저에 남는 건 두 가지뿐이에요.
  - 내가 건 장식을 뗄 때 쓰는 무작위 키
  - 내가 건 장식 목록

## 사용량 참고 (Firebase 무료 Spark 요금제)

- 장식 목록은 문서 1개(`trees/main`)에 모아 둬서, 한 번 볼 때 읽기 1회만 써요.
- 목록 응답은 Vercel CDN에 10초 동안 캐시돼요.
- 그래서 위젯을 하루 종일 켜 두고 친구들이 사이트를 봐도, 읽기 횟수가 무료 한도(하루 5만 회)보다 한참 적어요.

## 내 컴퓨터에서 미리 보기

```
npm install
npm run dev        # http://localhost:3000 (메모리 저장, 껐다 켜면 사라짐)
```

Firestore에 붙여서 실행하려면 `FIREBASE_SERVICE_ACCOUNT` 환경 변수를 설정하고 실행하면 돼요.
