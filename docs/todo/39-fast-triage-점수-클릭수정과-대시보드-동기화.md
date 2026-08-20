# 39. Fast Triage 점수 클릭 수정과 대시보드 동기화

## 목표

Fast Triage 상세 화면의 큰 점수 pill을 클릭해 수정하고, Tab 1 Home Dashboard 표의 TR·MoA·Data도 Tab 2와 동일한 human score 편집 흐름으로 연결한다.

## 작업 범위

1. 상세 화면 점수 pill의 더블클릭을 한 번 클릭으로 변경한다.
2. Tab 1 pipeline table의 TR·MoA·Data에 Tab 2와 같은 0~3점 편집기를 제공한다.
3. 기존 manual-review score override, 점수 색상, human 표시, 변경 이력 및 화면 간 동기화를 재사용한다.

## 완료 기준

- 별도 관리자 점수 행 없이 큰 점수 pill 클릭 시에만 선택기가 열린다.
- Tab 1/2 표와 상세 화면 중 어느 곳에서 수정해도 같은 human override 점수가 표시된다.
