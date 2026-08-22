# 89. Website 열 분리와 Shortlisting 링크 통일

## 목표

Website를 Evaluation Progress에서 분리하고, Tab 0·1·2·3의 링크 표현을 하나의 외부 링크 아이콘 체계로 통일한다.

## 완료 내용

1. Tab 0 Website를 Evaluation Progress 그룹 밖의 맨 오른쪽 독립 열로 이동했다.
2. Tab 0 Website는 Tab 1/2의 외부 링크 아이콘을 사용하며, URL 등록·수정은 Tab 0 관리자만 가능하게 유지했다.
3. Shortlisting(Tab 3) 관리 액션의 맨 오른쪽에도 동일 Website 열기 아이콘을 추가했다.
4. Tab 1·2·3 action 영역과 Tab 0 progress table의 기본 열 폭을 조정해 불필요한 가로 스크롤을 줄였다.

## 검증

- JavaScript 문법 검사
- FastAPI 문법 검사
- Step 0 진행 API 회귀 테스트

완료: 2026-08-22
