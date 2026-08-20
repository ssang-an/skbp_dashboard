# 52. Fast Triage JSON URL 복구와 AI 재파싱 안정화 (완료)

## 반영 내용

- `source_url` 키의 따옴표 없는 `http(s)` URL만 JSON 문자열로 자동 보정하고, 보정 수를 입력 검증 경고에 표시한다.
- Fast Triage와 Full Scout GPT 지침의 최종 JSON 점검에 올바른/잘못된 `source_url` 예시를 추가했다. Rubric 및 manifest version은 변경하지 않았다.
- AI 2차 파싱 SSE에서 OpenRouter 제공자 오류, 빈 응답, 출력 한도 도달을 구분해 사용자에게 표시한다.
- 무료 fallback 모델 호환성을 위해 AI 2차 파싱 기본 출력 한도는 6,000 tokens로 유지하고, 확인된 모델에서만 8,000 이상으로 상향하도록 `.env.example`에 안내했다.

## 검증

- 실제 문제 원문은 12개의 따옴표 없는 `source_url`을 보정한 뒤 6개의 Fast Triage record로 정상 파싱됨을 확인했다.
- Compact v2 확장 후 동일 6건이 FastAPI 저장 경계 검증까지 통과함을 확인했다.
- `python -m unittest tests.test_compact_ingestion` 통과 (27 tests).
- `python -m compileall -q main.py` 및 `git diff --check` 통과.
