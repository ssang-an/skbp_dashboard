# Team Review 점수 변경 사유와 AI 이력 요약 작업 로그

## 완료

- Team Review 변경 이력의 수동 기준 점수 및 Total Score 항목 아래에 변경 사유를 저장·수정할 수 있는 꼬리댓글 형태 입력란을 추가했다.
- 변경 사유는 관리자만 작성할 수 있고, 기존 이력도 일시·필드 기준으로 찾아 처음 저장할 때 식별자를 부여해 보존한다.
- 새 변경 이력에는 고유 식별자를 기록해 이후 사유를 정확한 이력 항목에 연결한다.
- AI 정성평가 생성 이력은 긴 답변 원문 대신 `정성평가 {기준명} AI 답변 생성 완료` 및 완료 상태만 표시한다.
- 저장된 점수 변경 사유는 입력칸 없이 읽기 전용으로 표시하고, 필요할 때만 `사유 수정`으로 다시 편집할 수 있게 했다.
- AI 정성평가 답변 삭제 이력은 원문 대신 `AI 생성 답변 삭제`로 요약하고, 사람이 남긴 정성평가·코멘트 삭제 이력은 기존 변경값 표시를 유지한다.

## 검증

- `node --check src/detail.js`
- `python -m py_compile main.py`
- `python -m unittest tests.test_dashboard_ia.DashboardInformationArchitectureTests.test_team_review_score_history_can_store_reasons_and_summarizes_ai_qualitative_entries`
