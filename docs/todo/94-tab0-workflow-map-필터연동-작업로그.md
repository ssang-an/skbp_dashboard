# Tab 0 Workflow Map 필터 연동 작업 로그

- Summary Dashboard 카드 아래에 Listing · Fast Triage · Full Scout · Shortlisting 4열 Pipeline node map을 추가했다.
- 그래프의 입력을 `step0FilteredSortedRows()`로 제한해 검색·복수 필터·요약 카드 필터와 결과 수가 일치하도록 했다.
- node는 원형 dot만 표시하고, hover/접근성 정보로 자산·회사·단계를 제공한다.
- `prefers-reduced-motion`에서 애니메이션을 비활성화하고 빈 결과 상태를 처리했다.
