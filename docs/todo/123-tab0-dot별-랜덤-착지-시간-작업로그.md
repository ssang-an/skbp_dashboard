# 123. Tab 0 DOT별 랜덤 착지 시간 작업로그

## 완료 내용

- DOT별로 1,000~2,000ms 범위의 결정론적 settle duration을 부여했다.
- 같은 화면에서는 DOT별 모션이 일관되지만, 서로 다른 시점에 감쇠·정지한다.
- 렌더 루프는 최대 2초의 착지 모션이 끝난 뒤 종료된다.

## 확인

- `test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과
- `node --check src/app.js` 통과
- `git diff --check` 통과 (기존 생성 파일의 CRLF 경고만 출력)
