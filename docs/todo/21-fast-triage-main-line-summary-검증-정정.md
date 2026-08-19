# 21. Fast Triage `main_line_summary` 점수 검증 정정

## 목표

- Fast Triage v3.3의 `main_line_summary`가 선두의 criterion 점수 표현만으로 검증되게 한다.
- asset code, 비율, decimal, trial/phase 등 과학적 수치를 점수로 오인하지 않는다.
- Compact v2 구조와 0~3 단일 점수 계약은 유지한다.

## 작업 순서

1. FastAPI와 대시보드 사전 검증의 점수 인식 규칙을 선두 prefix 전용으로 통일한다.
2. 오류에 record index, criterion, 기대 점수와 실제 prefix 점수(또는 미인식)를 포함한다.
3. GPT Fast Triage 지침에 concise prefix 및 상세 수치의 Markdown 배치를 명시한다.
4. 과학적 수치 허용 및 실제 prefix 불일치 거부 회귀 테스트를 추가하고 전체 Fast Triage 흐름을 검증한다.

## 완료 조건

- `TR 3 points: MEK1/2`, `Data 2 points: 65.4%, OR 2.12` 등은 통과한다.
- 선택 점수와 선두 score prefix가 다른 경우만 score mismatch로 실패한다.
