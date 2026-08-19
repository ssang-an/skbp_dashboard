# 25. 사용자 입력 근거 추적과 GPT 조사 반영

## 목표

- Fast Triage와 Full Scout 지침에 후보 목록 뒤 추가하는 사용자 메모를 `사용자 입력` 근거로 명확히 취급하도록 한다.
- 사용자 메모를 Compact v2 JSON의 `input.user_context`에 보존해 후속 저장·검증에서도 추적 가능하게 한다.
- 사용자 입력은 공개 출처와 구분하고, 검증되지 않은 메모가 점수를 과도하게 올리거나 공개 근거처럼 표시되지 않도록 한다.

## 작업 순서

1. 두 GPT 지침에 추가 사용자 입력의 사용·표시·검증 원칙을 추가한다.
2. Compact v2 schema, expansion, FastAPI 검증에 선택적 `input.user_context`를 지원한다.
3. prompt·확장·저장 회귀 테스트를 추가하고 실행한다.

## 범위 메모

- Rubric, 판단근거, rubric-release manifest 버전은 변경하지 않는다. 이는 사용자 제공 근거의 추적 방식 보완이다.
