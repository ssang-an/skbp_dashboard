# 131. Tab 0 Workflow 배경 드래그 고정 작업로그

## 완료 내용

- Tab 0 Summary Dashboard 워크플로 그래프에서 카드 배경을 드래그해 전체 Canvas가 이동하는 동작을 제거했다.
- DOT 자체의 직접 드래그는 유지했다.

## 확인

- `test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과
- `node --check src/app.js` 통과
- `git diff --check` 통과 (기존 생성 파일의 CRLF 경고만 출력)
