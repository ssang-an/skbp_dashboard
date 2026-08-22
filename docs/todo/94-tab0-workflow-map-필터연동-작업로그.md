# Tab 0 Workflow Map 필터 연동 작업 로그

- Summary Dashboard 카드 아래에 Listing · Fast Triage · Full Scout · Shortlisting 4열 Pipeline node map을 추가했다.
- 그래프의 입력을 `step0FilteredSortedRows()`로 제한해 검색·복수 필터·요약 카드 필터와 결과 수가 일치하도록 했다.
- node hover에는 자산·회사·단계 정보를 제공하고, 조사 완료 node는 상세 페이지 이동, Listing-only node는 Table 검색으로 연결했다.
- `prefers-reduced-motion`에서 애니메이션을 비활성화하고 빈 결과 상태와 긴 Asset 이름 축약 표시를 처리했다.
