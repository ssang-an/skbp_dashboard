# 52. Fast Triage JSON URL 복구와 AI 재파싱 안정화

## 목적

Fast Triage 원문 JSON의 `source_url`에 URL 문자열 따옴표가 누락되어도, 확인 가능한 문법 오류는 자동으로 보정해 업로드가 막히지 않도록 한다. AI 2차 파싱은 결정적 보정의 보조 수단으로 유지하되, OpenRouter의 실제 스트리밍 오류를 숨기지 않고 대용량 전체 재생성에 과도하게 의존하지 않도록 안내와 설정을 정비한다.

## 작업 범위

1. `src/combined-ingestion.js`에서 `source_url` 키에 한정해 따옴표 없는 `http://` 또는 `https://` 값을 안전하게 JSON 문자열로 보정한다.
   - 임의의 일반 텍스트나 다른 JSON 값은 변경하지 않는다.
   - 보정 횟수를 `repairActions`로 반환해 입력 검증 UI가 사용자에게 알린다.
2. Fast Triage와 Full Scout GPT 지침의 최종 JSON 점검에 올바른 `source_url` 예시와 잘못된 예시를 추가한다.
   - 점수·판단 기준·Rubric/manifest version은 변경하지 않는다.
3. AI 2차 파싱 SSE 처리에서 OpenRouter의 오류 이벤트와 비어 있는 종료 상태를 구분해 실제 원인을 표시한다.
4. 무료 모델을 기본 대상으로 `OPENROUTER_REPARSE_MAX_TOKENS=6000` 기본값을 유지하고, `.env.example`에 8,000 토큰 상향 적용 조건을 문서화한다.
   - 전체 JSON 재생성 한도 상향 대신 결정적 URL 보정을 우선해 무료 모델의 응답 길이·가용성 제약을 피한다.
5. 이번 첨부 사례와 URL에 쉼표가 포함된 경우, 기존 안전 복구 회귀 사례, 지침 렌더링을 테스트한다.

## 완료 기준

- `"source_url": https://example.com/a` 형태가 자동 보정되어 정상 JSON으로 파싱된다.
- 일반 URL 이외의 잘못된 JSON은 기존처럼 차단한다.
- 보정 사실이 검증 결과의 경고로 표시된다.
- OpenRouter가 SSE 오류 payload를 보내면 일반적인 `no usable response` 대신 구체적인 오류가 표시된다.
- 기본 출력 한도와 Rubric 버전은 바뀌지 않는다.
