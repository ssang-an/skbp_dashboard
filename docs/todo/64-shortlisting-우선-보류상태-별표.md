# 64. Shortlisting 우선·보류 상태 별표

## 목표

Tab 2 Team Review Workspace의 즐겨찾기 별표를 통해 Shortlisting 우선 검토와 보류 모니터링을 구분한다.

## 작업 범위

1. 별표 클릭을 `미등록 → 우선 검토 → Stationary(보류 모니터링) → 미등록` 순환으로 변경한다.
2. 우선 검토는 기존 노란색, Stationary는 강한 회색으로 표시한다.
3. hover/aria 문구에서 현재 상태와 다음 클릭 동작을 설명한다.
4. Stationary는 Shortlisting에 계속 남기되 OI 분류·점수·원문은 변경하지 않는다.
5. 상태 변경을 `meta.focus_management`와 변경 이력에 저장하고 회귀 테스트를 추가한다.
