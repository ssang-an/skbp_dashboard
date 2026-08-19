# 21. Fast Triage `main_line_summary` 점수 검증 정정 (완료)

## 반영 내용

- FastAPI와 입력 사전 검증이 TR/MoA/Data에 연결된 `N points` 또는 `N점`만 score 표현으로 인식한다.
- `MEK1/2`, 퍼센트, OR/decimal, stage 범위 등 본문의 과학적 수치는 점수로 해석하지 않는다.
- 현재 criterion과 다른 criterion의 명시적 score, score range, JSON score와의 불일치는 계속 거부한다.
- 오류에 record index, criterion, expected score, detected score expression을 함께 표시하고, 한 record 안의 score-summary 오류는 모아 표시한다.
- Fast Triage GPT 지침과 v3.3 기준 문서에 concise score prefix와 상세 수치의 Markdown/audit 배치를 명시했다. Compact v2 구조 및 rubric version은 변경하지 않았다.

## 검증

- `VersionAndPolicyTests` 16건 통과: 요청된 scientific numeric 사례, 실제 score 불일치, 기존 label 형식, FastAPI 저장 경로를 포함한다.
- `test_compact_ingestion` 통과 및 `main.py`/`src/app.js` 문법 검사 통과.
- `test_record_storage`의 worktree-baseline 비교 1건은 기존의 사용자 데이터 변경(`json/pipeline-records.json`)으로 실패했으며, 이번 validator 변경과 무관하다.
