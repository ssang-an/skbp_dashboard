# 37. Fast Triage 상세 점수 인라인 수정

## 목표

Fast Triage(Tab 1) 상세 화면에서 기준별 별도 `관리자 점수` 드롭다운을 제거하고, 관리자만 점수 pill을 더블클릭해 0~3점으로 수정하게 한다.

## 작업 범위

1. Target Area Relevance, MoA Validity, Data Maturity의 별도 관리자 점수 행을 제거한다.
2. 관리자에게만 점수 pill의 더블클릭 및 키보드 수정 진입을 제공한다.
3. 기존 `manual-review` score API를 재사용해 원문 GPT 점수는 보존하고 human override·변경 이력을 남긴다.
4. 대시보드의 effective score 계산이 동일 override를 읽는지 회귀 테스트로 확인한다.

## 완료 기준

- 상세 화면에 별도 관리자 점수 드롭다운이 없다.
- 점수 pill을 더블클릭하면 해당 기준의 0~3점 선택기가 그 자리에서 열린다.
- 저장된 수정 점수는 Home Dashboard와 상세 Total에 반영된다.
