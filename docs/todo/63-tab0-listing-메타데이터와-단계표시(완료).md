# 63. Tab 0 Listing 메타데이터와 단계 표시 (완료)

## 완료 내용

- `Asset | Company | Comment | Contact` Excel 탭 붙여넣기와 기존 2열 입력을 모두 지원한다.
- Listing 대기열과 동일 pipeline의 조사 레코드에 내부 `pipeline_metadata`를 영속 보존하며, 빈 재입력은 기존 Comment/Contact를 지우지 않는다.
- Tab 0 진행 표를 `Listing → Fast Triage → Full Scout → Shortlisting → Comment → Contact` 순서로 확장했다. 진행 완료는 체크, 미완료는 `−`로 표시한다.
- Listing 도입 전의 기존 Fast Triage/Full Scout 레코드도 이미 후보 목록에 등록된 것으로 보고 Listing 완료로 표시해 단계 순서가 끊기지 않게 했다.
- Comment/Contact는 표시를 클릭해 확인하고, 더블클릭 또는 빈 표시 클릭으로 편집한다. 명시적으로 빈 값으로 저장하면 해당 항목을 삭제한다.
- Fast Triage Quick Summary와 Full Scout Team Review에 내부 메타데이터를 읽기 전용으로 표시한다.
- Tab 0 검색 및 CSV 내보내기에 Comment/Contact를 포함했다. 내부 메타데이터는 GPT 원문, 출처, 점수, 루브릭 판단에 사용하지 않는다.

## 검증

- 파싱·병합·승격 단위 테스트, Python/JavaScript 문법 검사 및 기존 Tab 0 최근 업로드 회귀 테스트를 실행한다.

상세 작업 로그: `63-tab0-listing-메타데이터와-단계표시-작업로그.md`
