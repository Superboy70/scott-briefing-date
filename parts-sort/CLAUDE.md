# 부품함 정리 (partsSort) — 작업 규칙

기획·재미 정의·목표 숫자는 **`docs/PLAN.md`**, 진행상황·다음 첫 일은 **`NOTES.md`**. 이 파일은 규칙·절차만 둔다(짧게 유지). 공통 절차는 DEV_PLAYBOOK.

## 구조
- 소스 `src/`: `core.js`(규칙·해결기·생성기·초보 봇 — 게임과 도구가 **같은 파일**을 씀), `game.js`(화면·입력·저장), `style.css`, `body.html`, `levels.json`(생성 결과).
- 빌드 `node tools/build.js` → `web/`(배포판, git 포함) + `dist/artifact.html`(아티팩트판, git 제외). **`web/`을 손으로 고치지 않는다.**
- 버전은 `VERSION` 파일 하나. 빌드가 게임 `APP_VERSION`과 `sw.js` 캐시 이름에 같이 넣는다.

## 절차
1. 수정 → `node tools/build.js` → **`node tools/smoke.js` 통과**(버전 일치·오류 0·1레벨 해답대로 깸·옛 저장·폰 화면·아티팩트판) → 커밋.
2. 레벨·곡선을 바꾸면: `node tools/gen_levels.js --cands 24` → `node tools/fun_report.js --save`로 판정하고 `tools/results.csv`에 한 줄 남김. 목표 구간은 `tools/curve.js` = `docs/PLAN.md` "목표 숫자".
3. 체감이 필요한 변경(손맛·연출·UI·난이도)은 preview 먼저 → Scott 확인 → 본 배포. 버그 수정만 바로.
4. 확인 대기는 **자동**(Claude가 스크린샷 `node tools/smoke.js --shots` → `tools/out/`)과 **체감**(Scott)으로 나눠 NOTES에 적는다. 체감 대기가 3개를 넘으면 새 기능을 멈춘다.
5. 시험 주소: `?level=N`(잠긴 레벨도 바로), `?mute=1`(소리 엔진을 안 만듦). 스모크·봇은 `window.__game`.

## 깨면 안 되는 것
- **저장 키** `partsSort.save.v1` = `{v, unlocked, best:{레벨:수}, sound}`. 옛 저장이 계속 열려야 한다(새 필드는 기본값). 저장 형식을 바꾸면 `tools/smoke/saves/`에 그 버전 저장 파일을 추가.
- **레벨 순서·내용**: 출시 뒤 기존 레벨 번호의 판을 바꾸지 않는다(최고 기록이 어긋남). 새 레벨은 뒤에 붙인다.
- `sw.js`는 `/api/`를 캐시하지 않는다(마계 성전 순위 버그에서 배운 규칙).
- 공개 호스팅·계정·광고·결제처럼 밖으로 나가는 결정은 Scott 결정.
