# 19. Fast Triage 상세 검토 흐름 통일 (완료)

## 구현 내용

- Fast Triage의 Target Area Relevance, MoA Validity, Data Maturity 점수를 관리자만 0–3점으로 수정할 수 있게 했다. 원래 GPT 점수는 보존하고 `human_review.overrides`에 별도로 저장한다.
- 상세 점수 카드의 합계를 유효 오버라이드 기준 `Total N / 9`로 표시하고, 사람이 수정한 카드는 기존 점수 톤을 유지한 더 진한 동색 테두리로 표시한다.
- 각 점수 카드에 `코멘트 입력` 버튼을 추가했다. 필요할 때만 포스트잇 형태 입력란이 열리며, 기존 Topic Note API와 변경 이력을 사용해 저장한다.
- 판단 요약에 관리자 전용 Final comment를 추가했다. 입력·수정은 수동 검토 API와 변경 이력에 기록된다.
- 우측 Quick scan에 점수·Final comment·기준별 코멘트를 포함한 검토 변경 이력을 표시한다.
- 화면에는 `triage_only`와 Flags를 더 이상 노출하지 않는다. Flags 데이터는 Fast Triage 자동 hard-blocker 판정에 계속 필요하므로 저장 데이터에서는 삭제하지 않았다.
- 강조 원형과 굵은 좌측 상태선을 제거하고, 원문 리포트·점수 카드·인라인 메모의 톤을 Full Scout 상세와 가까운 차분한 패널 스타일로 정리했다.

## 검증

- `.venv\\Scripts\\python.exe -m unittest tests.test_fast_triage_manual_review`
- `node --check src/triage-detail.js`
- `.venv\\Scripts\\python.exe -m py_compile main.py`
- `git diff --check`
