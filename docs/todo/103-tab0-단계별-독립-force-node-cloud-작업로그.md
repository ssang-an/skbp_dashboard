# Tab 0 단계별 독립 Force Node Cloud 작업 로그

## 결과

- Summary 카드 바로 아래에 Listing · Fast Triage · Full Scout · Shortlisting 순서의 독립 G6 force canvas 4개를 배치했다.
- Listing cloud는 현재 필터 결과의 전체 후보를, 이후 3개 cloud는 각 단계 완료 후보만 표시한다. 동일 Pipeline이 다음 단계를 완료했으면 해당 단계 cloud에도 별도 node로 보인다.
- 그래프 내부의 단계명, 건수, 연결선은 모두 제거했다. 단계 이름과 전체 수는 상단 Summary 카드만 사용한다.
- 각 cloud는 d3-force의 반발력·충돌 방지·중심 인력으로 빠르게 정착하고, node drag interaction과 hover 정보는 유지한다.
- 확인: `DashboardInformationArchitectureTests.test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과, `node --check src/app.js` 통과, `git diff --check` 통과.
