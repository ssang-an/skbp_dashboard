# 70. 다중 Indication 정규화와 OR 필터 복원

## 목표

한 Pipeline에서 여러 적응증이 확인된 경우에도 Home Dashboard가 `Unknown`으로 축약하지 않고, canonical indication library 기준의 전체 적응증을 표시·필터링한다.

## 작업 범위

1. 공식 lead indication이 있으면 이를 Main indication으로 사용한다.
2. lead가 확인되지 않았지만 적응증이 여러 개면, 원문에 나타난 순서의 첫 canonical indication을 Main indication으로 사용한다.
3. `structured_table.indication_list`에는 모든 확인된 canonical indication을 원문 순서로 유지한다.
4. 다중 선택 indication filter는 선택값 중 하나라도 indication_list에 있으면 결과를 보이는 OR 조건을 유지한다.
5. Fast Triage·Full Scout GPT 지침, 서버 정규화, schema 설명, 회귀 테스트를 같은 규칙으로 맞춘다.

## 비범위

- 점수 Rubric과 manifest 버전은 바꾸지 않는다.
- 공식 source가 확인하지 않은 적응증을 임의 추정하지 않는다.

## 완료 기준

- `Focal onset seizure; major depressive disorder; pain`은 Main indication에 `Epilepsy / seizure disorders`를 먼저 표시하고 세 적응증 모두 필터 대상이 된다.
- 명시적 또는 임상 단계 근거의 lead indication은 계속 우선한다.
- canonical indication이 하나도 확인되지 않은 경우에만 `Unknown`을 표시한다.
