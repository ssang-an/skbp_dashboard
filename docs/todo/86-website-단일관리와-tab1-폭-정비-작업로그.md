# 86. Website 단일관리와 Tab 1 폭 정비 — 작업 로그

## 2026-08-22

- Tab 1 Fast Triage는 재평가 → 지침 복사 → Website, Tab 2 Full Scout는 새로고침 → 즐겨찾기 → Website 순서로 아이콘을 배치했다.
- Tab 1·2 Website 아이콘은 단일 클릭으로 Tab 0 Listing의 공유 URL을 열기만 하며, 주소 등록·수정은 Tab 0에서만 수행한다.
- 메인 Dashboard의 Stage 기본 폭을 78px, 최소 폭을 68px으로 줄이고, 세 개의 관리 아이콘을 위한 열 폭을 명시해 불필요한 가로 스크롤을 줄였다.
- 기존 브라우저 저장 열 폭에서도 넓은 Stage 값은 새 기본 폭으로 보정된다.
- JavaScript 구문 검사와 Listing metadata 회귀 테스트를 통과했다.
