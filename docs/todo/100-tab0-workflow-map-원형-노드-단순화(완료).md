# Tab 0 Workflow Map 원형 노드 단순화

## 목적

Workflow Map을 정보 패널이 아닌 동적 그래프뷰로 단순화한다. 각 Pipeline은 이름 대신 작은 원형 node 하나로 표시하고, 단계별 node 밀도로 현재 필터 결과의 규모를 즉시 파악할 수 있게 한다.

## 작업 순서

1. Workflow Map의 제목, 설명, 결과 문구, node label을 제거한다.
2. 각 Pipeline을 단계별 compact circular node로 렌더링한다.
3. hover·aria-label에만 Asset/Company/Stage 정보를 유지한다.
4. 기존 필터 연동·애니메이션·reduced-motion 처리는 유지한다.
