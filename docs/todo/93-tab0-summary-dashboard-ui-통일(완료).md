# 93. Tab 0 Summary Dashboard UI 통일

## 목표

Tab 0 진척 현황을 Tab 1·2·3와 같은 정보 구조로 정리한다. 후보 목록 관리의 역할을 한 줄 안내로 먼저 제시하고, 그 아래에 `Summary Dashboard`라는 공통 구획 안에서 기존 진척 현황 카드를 제공한다.

## 작업 범위

1. Tab 0 상단에 정보 아이콘을 포함한 `후보 목록 관리 ·` 안내 행을 추가한다.
2. 안내 문구는 Listing부터 Fast Triage, Full Scout, Shortlisting까지의 진척을 관리한다는 의미를 짧고 명확하게 전달한다.
3. 기존 Listing/Fast Triage/Full Scout/Shortlisting 요약 카드를 `Summary Dashboard` 구획 아래로 배치한다.
4. 기존 요약 카드의 수치, 최근 15일 증가 표시, 카드 클릭 필터 동작은 변경하지 않는다.
5. 다음 Workflow Map 구현이 현재 Tab 0 필터 결과만 사용하도록 별도 설계 문서를 작성한다.

## 완료 기준

- Tab 0도 Tab 1·2·3와 같은 안내 행 → Summary Dashboard → 상세 제어/표의 흐름을 가진다.
- 기존 진행 수치와 카드 필터가 그대로 동작한다.
- 좁은 화면에서도 Summary Dashboard 제목과 범위 문구가 자연스럽게 줄바꿈된다.
