# 53. DeepSeek AI 2차 파싱 자동 완결성 검증

## 목표

AI 2차 파싱을 DeepSeek V4 Flash로 통일하고, 사용자가 출력 잘림 여부를 직접 판단하지 않아도 되도록 JSON 완결성 검증과 제한적 재시도를 제공한다.

## 작업 범위

1. 2차 파싱 전용 기본 모델을 `deepseek/deepseek-v4-flash`로 지정하고, 8,000-token ceiling 및 16,000-token 단 1회 재시도 설정을 추가한다.
2. OpenRouter structured JSON 응답과 reasoning 비활성화를 요청해 자유 형식 출력 오류를 줄인다.
3. provider finish reason, JSON 완결성, record 수, Fast Triage Markdown 행 수, 저장 경계 스키마, output token usage를 점검한다.
4. 불완전 결과에만 16,000-token 재시도를 실행하고, 재시도 실패 시 원인과 시도 횟수가 보이는 오류를 반환한다.
5. 회귀 테스트와 설정 문서를 업데이트한다.

## 완료 기준

- 정상 JSON은 첫 8K 시도에서 바로 반환된다.
- `length`, JSON 미완결, record 수 불일치, 스키마 실패가 발생하면 정확히 한 번만 16K 재시도한다.
- 재시도 후에도 실패하면 저장하지 않고 명확한 오류를 표시한다.
- Compact v2 입력/저장 계약과 rubric version은 변경하지 않는다.
