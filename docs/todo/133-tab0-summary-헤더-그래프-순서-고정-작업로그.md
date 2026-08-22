# Tab 0 Summary Dashboard 헤더·그래프 순서 고정 작업로그

- 공통 `.visual-dashboard-toggle-bar`의 `order: 3`이 Tab 0 Summary flex wrapper 안에서도 적용돼 카드가 헤더보다 앞서는 것을 확인했다.
- Tab 0 Summary wrapper의 직접 자식에 헤더 `order: 0`, 카드 `order: 1`을 지정해 표시 순서를 고정했다.
