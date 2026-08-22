# Tab 0 G6 Force 물리 그래프 작업 로그

## 결과

- 그래프 내부의 단계명·단계별 건수·4개 열 배경을 모두 제거했다. 상단 Summary 카드만 전체 건수를 안내한다.
- 한 Pipeline은 Listing node부터 현재 완료 단계 node까지 연결된 chain으로 생성된다. 따라서 Fast Triage 이상 Pipeline은 단계 간 연결선을 통해 실제 진행 경로를 보인다.
- G6 `d3-force` layout의 node 반발력, edge 인력, 충돌 방지와 초기 animation을 적용했다. node는 직접 drag하면 주변 연결 node가 반응하는 force interaction을 제공한다.
- 단계별 circle 크기는 Listing 7px · Fast Triage 10px · Full Scout 14px · Shortlisting 18px로 설정했다.
- 확인: `DashboardInformationArchitectureTests.test_step0_workflow_map_uses_filtered_rows_and_g6_stage_nodes` 통과, `node --check src/app.js` 통과, `git diff --check` 통과.
