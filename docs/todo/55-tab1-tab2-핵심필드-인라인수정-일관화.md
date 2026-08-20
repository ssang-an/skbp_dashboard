# 55. Tab 1·Tab 2 핵심 필드 인라인 수정 일관화

## 목표

Fast Triage(Tab 1)와 Full Scout(Tab 2) 파이프라인 표에서 관리자 수동 사실 정정을 같은 방식으로 제공한다. Asset 더블클릭이 상세 페이지 이동으로 선점되지 않게 하고, Company·Asset·Target은 텍스트 입력으로, Modality와 Stage는 선택 메뉴로 정정한다.

## 작업 범위

1. Asset 링크의 즉시 페이지 이동을 제거하고 표 행 이동과 더블클릭 편집 이벤트가 충돌하지 않도록 조정한다.
2. Tab 1·Tab 2에서 Company, Asset, Target의 더블클릭 텍스트 편집을 공통화한다.
3. Unknown Modality는 더블클릭 시 표준 Modality 선택 메뉴로 바꾸고, 서버에서 canonical value만 저장한다.
4. Stage 선택과 사실 필드 변경을 기존 수동 변경 이력에 남기며, 표에서는 기존 색상 대신 절제된 굵기로만 사람이 바꾼 값을 표시한다.
5. Tab 1 Target도 Tab 2와 같이 여러 줄로 보이게 하되, 행 높이를 과도하게 키우지 않도록 최대 3줄로 제한한다.

## 검증

- 관리자/비관리자 렌더링과 Tab 1·Tab 2 모두에서 이벤트 충돌이 없는지 점검한다.
- manual-review API의 modality 저장, canonicalization, 변경 이력 기록을 테스트한다.
- 관련 회귀 테스트를 실행한다.
