# 07. F/U Action due date 정렬 작업 로그

## 반영 내용

- Tab3 Summary Dashboard의 F/U Action은 Action date가 설정되고 유효한 항목만 표시한다.
- 목록은 due date가 가장 이른 항목부터 정렬하며, 같은 due date에서는 최신 업데이트 순으로 정렬한다.
- overdue, 30일 이내, 이후 예정 상태는 유지하고 Action date 미등록·Filter 3 미확인만으로 생성되던 목록 항목은 제거한다.
- 최대 10개와 독립 스크롤은 그대로 유지한다.

## 검증

- F/U Action 렌더링의 due-date filter와 정렬 조건을 dashboard IA 테스트로 확인한다.
