# 129. Summary Dashboard 도넛·카운트업 애니메이션 작업로그

## 완료 내용

- Tab 1·2·3 Summary Dashboard의 indication, modality, PASS/partnership 도넛 segment를 짧게 순차 펼치도록 했다.
- 각 도넛 중앙 값과 범례 건수를 함께 카운트업한다.
- reduced-motion 환경은 애니메이션 없이 최종 값을 즉시 표시하며, 탭·필터 재렌더 시 기존 프레임과 타이머를 취소한다.

## 확인

- `test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과
- `node --check src/app.js` 통과
- `git diff --check` 통과 (기존 생성 파일의 CRLF 경고만 출력)
