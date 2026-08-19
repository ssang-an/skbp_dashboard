# 25. 사용자 입력 근거 추적과 GPT 조사 반영 (완료)

## 반영 내용

- Fast Triage와 Full Scout GPT 지침에 후보 목록/회사·자산 정보 뒤 추가한 meeting note·가설·내부 관찰·조사 요청을 `user_text` 근거로 처리하는 원칙을 추가했다.
- 사용된 사용자 메모는 Compact v2 JSON의 `input.user_context`에 보존되고, Markdown에는 `Source: User input (not independently verified)`로 표시하도록 했다.
- 사용자 입력은 조사 방향과 직접 진술된 사실의 해석에 사용하지만, 검증된 공개 출처가 아니며 URL·공개 source registry·criterion source ID를 만들지 않도록 했다. 검증된 공개 근거와 충돌하면 공개 근거를 우선한다.
- `input.user_context`는 최대 6,000자로 schema·Compact expansion·FastAPI 저장 검증·클라이언트 preflight에 반영했다.
- Fast Triage의 기존 `MoA/Data 2점 이상에는 검증된 공개 technical source 필요` 조건은 유지한다.

## 버전

- Rubric, 판단근거, rubric-release manifest 버전은 변경하지 않았다. 사용자 입력의 provenance와 보존 경로만 보완했다.

## 검증

- `node --check src/app.js`
- `node --check src/compact-ingestion.js`
- `python -m unittest tests.test_compact_ingestion` (25 tests)
