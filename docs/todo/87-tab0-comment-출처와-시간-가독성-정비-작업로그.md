# 87. Tab 0 Comment 출처와 시간 가독성 정비 — 작업 로그

## 2026-08-22

- Excel 일괄 업로드 Comment는 `Tab 0 · Team Comment · Tab 0 Team Review`로, 관리자 작성·수정 Comment는 `Tab 0 · Listing Comment · 관리자 이름`으로 표시되도록 했다.
- Comment 피드의 ISO/UTC timestamp를 브라우저 현지 시간 기준의 읽기 쉬운 한국어 날짜·시간으로 변환했다.
- Listing metadata 회귀 테스트, Python 컴파일, JavaScript 구문 검사를 통과했다.
