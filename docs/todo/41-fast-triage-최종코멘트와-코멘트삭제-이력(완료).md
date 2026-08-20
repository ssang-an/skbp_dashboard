# 41. Fast Triage 최종 코멘트와 코멘트 삭제 이력 (완료)

- UNVERIFIED 설명을 `공개 자료로 asset identity를 확인하지 못함`으로 축약했다.
- 최종 코멘트를 우측 Quick scan의 변경 이력 바로 위로 옮겼고, 관리자 입력 pill과 작성자 전용 `×` 삭제 버튼을 제공한다.
- 기준별 코멘트에도 동일한 작성 관리자 전용 삭제 버튼을 추가했다.
- 최종/기준별 코멘트의 입력·삭제는 `meta.edit_history`에 남는다.

## 검증

- Fast Triage manual-review 단위 테스트 및 JavaScript 문법 검사를 실행했다.
