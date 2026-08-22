# Tab 0 단계별 독립 Force Node Cloud 구현

## 목적

Summary 카드의 Listing·Fast Triage·Full Scout·Shortlisting 각각 아래에 독립된 G6 force node cloud를 표시한다. 하나의 연결 그래프나 단계 연결선은 사용하지 않는다.

## 작업 순서

1. 현재 필터 결과에서 각 완료 단계별 Pipeline 집합을 개별적으로 계산한다. Listing은 전체 Listing 후보, 이후 단계는 해당 조사가 완료된 후보를 사용한다.
2. 4개의 독립 G6 `d3-force` canvas를 Summary 카드 순서와 동일하게 배치한다.
3. 각 cloud에는 node만 표시하고, 중복 제목·건수·연결선은 표시하지 않는다.
4. 단계별 색상·원형 크기·hover 정보·drag interaction을 유지한다.
5. 회귀 테스트와 구문 검사를 실행하고 변경 로그를 남긴다.
