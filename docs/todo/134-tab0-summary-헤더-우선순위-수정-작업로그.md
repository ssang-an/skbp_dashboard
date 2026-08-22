# Tab 0 Summary Dashboard 헤더 우선순위 수정 작업로그

- 이전 Tab 0 전용 selector는 공통 `.visual-dashboard-toggle-bar { order: 3; }` selector보다 specificity가 낮아 실제 브라우저에서 무시됐다.
- 공통 selector 범위를 포함한 Tab 0 전용 selector로 헤더 `order: 0`, 카드 `order: 1`을 재정의했다.
