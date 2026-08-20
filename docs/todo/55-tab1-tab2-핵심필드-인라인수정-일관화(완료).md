# 55. Tab 1·Tab 2 핵심 필드 인라인 수정 일관화 — 완료

## 완료 내용

- Tab 1과 Tab 2에서 Company·Asset·Target을 관리자 더블클릭 텍스트 수정으로 통일했다.
- Asset 셀의 직접 링크를 제거해 첫 클릭으로 상세 페이지로 이동하던 충돌을 없앴고, 다른 행 영역을 클릭하면 기존처럼 상세 페이지로 이동한다.
- `Unknown` Modality는 관리자 더블클릭 시 canonical Modality 선택 메뉴를 열며, 서버는 선택값을 정규화해 저장한다.
- Stage는 기존 선택 메뉴를 유지하고, Company·Asset·Target·Modality·Stage의 변경은 기존 수동 변경 이력과 절제된 굵기 표시를 사용한다.
- Fast Triage Target도 Full Scout와 동일하게 최대 3줄까지 표시해 긴 Target이 행 안에서 읽히도록 했다.

## 검증

- `node --check src/app.js` 통과.
- `python -m unittest tests.test_fast_triage_manual_review` 통과.
- Tab 1·Tab 2 렌더링/이벤트 정적 회귀 테스트를 추가했다.
- 브라우저 자동화 연결은 이 실행 환경에서 사용할 브라우저가 없어 수행하지 못했다.
