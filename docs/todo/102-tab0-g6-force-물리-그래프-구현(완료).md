# Tab 0 G6 Force 물리 그래프 구현

## 목적

Tab 0 Workflow Map을 단계별 정렬 레인이 아닌 Obsidian Graph View처럼 힘 기반으로 떠 있는 관계 그래프로 전환한다. Summary 카드의 숫자는 유지하되, 그래프 내부에서 반복되던 단계명·건수 표시는 제거한다.

## 작업 순서

1. 각 Pipeline을 Listing부터 최고 완료 단계까지의 연속 node chain으로 구성한다.
2. G6 `d3-force` layout의 반발력·충돌 방지·연결 인력·초기 배치 애니메이션을 적용한다.
3. 단계별 circle 크기와 색상은 유지하되, graph 내부의 텍스트·열 배경·정렬 규칙을 제거한다.
4. node hover와 force drag를 제공하고, 필터 변경 시 새 관계 그래프를 생성한다.
5. 회귀 테스트와 JS 구문 검사를 실행하고 변경 로그를 남긴다.
