# 124. Tab 0 DOT별 착지 시간 3초 확장 작업로그

## 완료 내용

- DOT별 감쇠·정지 모션 지속시간을 1,500~3,000ms 범위로 확장했다.
- 마지막 DOT가 멈출 때까지 렌더 루프를 유지한 뒤 종료한다.

## 확인

- `test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과
- `node --check src/app.js` 통과
- `git diff --check` 통과 (기존 생성 파일의 CRLF 경고만 출력)
