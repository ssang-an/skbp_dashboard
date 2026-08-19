# 30. Shortlisting 자료 보유 항상 표시

## 목표

- Team Review Workspace가 접힌 초기 상태에서도 Shortlisting의 Filter 3 판단근거와 그 아래 자료 보유 pill을 표시한다.
- Show 버튼은 담당자·F/U 계획 등 나머지 상세 정보만 제어하도록 유지한다.

## 작업 순서

1. 접힌 Review Workspace 상태에서 Filter 3 판단근거와 자료 보유 영역을 숨기는 규칙을 제거한다.
2. 기존 DOM 순서(판단근거 다음 자료 보유)를 유지하는지 확인한다.
3. CSS diff 공백 오류를 확인한다.
