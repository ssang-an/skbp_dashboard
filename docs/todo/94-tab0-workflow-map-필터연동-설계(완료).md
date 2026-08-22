# 94. Tab 0 Workflow Map 필터 연동 설계

## 목적

Tab 0의 Summary Dashboard 아래에 Listing → Fast Triage → Full Scout → Shortlisting 흐름을 보여 주는 인터랙티브 Workflow Map을 추가한다. 그래프는 전체 누계가 아니라 사용자가 현재 선택한 검색·Country·Modality·Theme·Cluster·Main indication·Stage·진행 단계 필터 결과만 시각화한다.

## 데이터 기준

1. 그래프의 유일한 입력은 `step0FilteredSortedRows()`가 반환하는 현재 표 행이다.
2. 각 행은 하나의 pipeline node이며, `pending`, `fast_triage`, `full_scout`, `shortlisting` 진행 상태로 열을 정한다.
3. Summary 카드의 전체 누계와 그래프의 필터 결과 수는 혼동하지 않는다. 그래프는 단계별 node 수로 필터 결과를 표현한다.
4. 한 pipeline은 현재 가장 높은 조사 단계에만 기본 배치한다. 선택 시에는 Listing에서 현재 단계까지의 이력 경로를 강조한다.

## UI 및 상호작용

1. 4개 고정 열과 단계별 count badge를 사용하고, 각 Pipeline은 이름을 노출하지 않는 작은 원형 node 하나로 표시한다.
2. 초기 진입 시 모든 node가 Listing 열에서 시작해 자신의 현재 단계로 순차 이동하는 짧은 애니메이션을 제공한다. `prefers-reduced-motion: reduce`에서는 즉시 최종 위치로 표시한다.
3. node hover에는 Company, Asset, 현재 단계, Stage를 보여 준다.
4. 수백 건에서도 읽기 쉽도록 같은 열 안에서 compact dot graph와 내부 스크롤을 사용한다.
5. 검색/필터/요약 카드 필터가 바뀔 때마다 지도와 count를 다시 계산한다. 현재 필터가 0건이면 빈 상태 안내만 표시한다.

## 접근성 및 성능 기준

- 색상만으로 진행 단계를 구분하지 않고 단계명·aria-label을 함께 제공한다.
- 애니메이션은 사용자 입력을 막지 않으며, 필터 변경 중 이전 animation frame을 취소한다.
- 첫 구현은 750건 수준에서 60fps를 목표로 하되, 대량 데이터는 Canvas 또는 DOM windowing 전환 기준을 측정한다.

## 구현 전 검증

- 다중 필터, 검색 token, 진행 단계 카드 필터 각각에서 node 수가 표의 필터 결과 수와 일치한다.
- 같은 Asset의 Full Scout/Shortlisting 우선 표시 규칙과 Tab 0 표의 공식 값 표시 규칙이 일치한다.
- reduced-motion, 키보드 탐색, 빈 결과, 긴 Asset 이름을 테스트한다.

## 구현 결과

- Tab 0 Summary Dashboard 안에 4단계 Workflow Map을 추가했다.
- 현재 필터 결과만 사용하고, 각 Pipeline은 가장 높은 완료 단계 열에 한 번만 표시한다.
- node 이름은 화면에 표시하지 않고 native hover 정보 및 `aria-label`로만 제공한다.
- node는 Listing에서 다음 단계로 진행되는 방향을 나타내는 짧은 entrance animation을 사용하고, reduced-motion 환경에서는 즉시 표시한다.
