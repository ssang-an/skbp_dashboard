# 128. Tab 0 DOT별 착지 시간 5초 확장 작업로그

## 완료 내용

- DOT별 오버슈팅·미세 감쇠 모션을 1,500~5,000ms 범위로 확장했다.
- 생성·출발 시차와 최종 정지 좌표는 기존 규칙을 유지했다.

## 확인

- `test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과
- `node --check src/app.js` 통과
- `git diff --check` 통과 (기존 생성 파일의 CRLF 경고만 출력)
