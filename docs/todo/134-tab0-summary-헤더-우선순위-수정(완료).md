# Tab 0 Summary Dashboard 헤더 우선순위 수정

## 목표

공통 대시보드 CSS보다 높은 우선순위로 Tab 0 Summary Dashboard 헤더가 그래프 카드 위에 유지되게 한다.

## 작업

- [x] 기존 순서 규칙이 공통 `.visual-dashboard-toggle-bar` 규칙보다 낮은 CSS specificity를 가진 것을 확인한다.
- [x] 동일 범위의 selector specificity로 Tab 0 내부 헤더와 카드 순서를 재정의한다.
- [x] 회귀 테스트와 정적 검사를 실행한다.
