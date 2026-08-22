# 130. Full Scout 대기 후보 바차트 애니메이션 작업로그

## 완료 내용

- Fast Triage Summary Dashboard의 Full Scout 대기 후보 Stage 바가 105ms 간격으로 순차 확장된다.
- 각 Stage 건수도 680ms 동안 카운트업된다.
- reduced-motion 환경에서는 즉시 최종 값을 표시한다.

## 확인

- `test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과
- `node --check src/app.js` 통과
- `git diff --check` 통과 (기존 생성 파일의 CRLF 경고만 출력)
