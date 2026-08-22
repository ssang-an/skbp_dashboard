# 132. Tab 0 Summary 접기 레이아웃 고정 작업로그

## 완료 내용

- Tab 0 Summary Dashboard의 헤더와 통계 카드가 하나의 gap 없는 세로 흐름을 유지하도록 했다.
- 그래프를 접어도 헤더는 독립 카드처럼 분리되지 않고, 아래 통계 카드와 같은 상단 위치에서 이어진다.

## 확인

- `test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과
- `node --check src/app.js` 통과
- `git diff --check` 통과 (기존 생성 파일의 CRLF 경고만 출력)
