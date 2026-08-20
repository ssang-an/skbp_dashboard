# 37. Fast Triage 상세 점수 인라인 수정 (완료)

## 반영 결과

- 별도 `관리자 점수` 드롭다운 행을 제거했다.
- 관리자만 점수 pill을 더블클릭하거나 Enter/Space로 선택기를 열어 0~3점을 수정할 수 있다.
- 기존 manual-review score 저장 경로를 사용하므로 GPT 원문 점수는 보존되고 human override, 변경 이력, Home Dashboard effective score가 함께 갱신된다.
- 점수 색상 체계는 유지하고 수정 진입 상태도 동일한 score pill 안에서만 표시한다.
