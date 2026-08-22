# 92. LLM Wiki 워크플로우 그래프 고도화 작업로그

- `export_pipeline_wiki.py`가 `pipeline-records.json`과 같은 위치의 `candidate-queue.json`을 함께 읽도록 확장했다.
- Listing, Fast Triage, Full Scout, 실제 Tab 3 Shortlisting을 Workflow 노트와 graph node/edge로 표현했다.
- OI Partnership 분류, Priority/Stationary, 자료 보유, Contact·Website·사람 작성 운영 코멘트를 Workflow 노트의 속성으로 기록했다.
- 추천 기반 `Recommendation Shortlist`와 실제 Tab 3 `OI Shortlisting` 대시보드를 분리했다.
- Scorecard 파일명에 record ID를 포함해 동일 asset/date 조사본의 덮어쓰기를 방지했다.
- 임시 vault 기반 workflow 회귀 테스트 및 기존 exporter 호환 테스트를 통과했다.
