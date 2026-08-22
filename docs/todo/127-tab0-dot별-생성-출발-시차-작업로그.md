# 127. Tab 0 DOT별 생성·출발 시차 작업로그

## 완료 내용

- 각 DOT는 초기에는 숨겨지고 0~720ms 범위의 서로 다른 시점에 나타난다.
- 나타난 DOT는 170ms 동안 부드럽게 보인 뒤 기존 좌측 출발·오버슈팅·감쇠 모션을 수행한다.
- 전체 프레임 루프는 가장 늦은 DOT의 3초 settle 종료 시점까지만 유지한다.

## 확인

- `test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과
- `node --check src/app.js` 통과
- `git diff --check` 통과 (기존 생성 파일의 CRLF 경고만 출력)
