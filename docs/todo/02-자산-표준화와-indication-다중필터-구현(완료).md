# 02. 자산 표준화와 indication 다중 필터 구현

## 완료 내용

- `structured_table.indication_list`를 선택적 문자열 배열로 추가했다. 저장 정규화 시 기존 상세 indication 원문과 lead bucket에서 자동 backfill하며, 기존 `main_indication`은 바꾸지 않는다.
- 표의 indication 셀은 lead를 먼저 보여 주고 확인된 추가 indication을 쉼표로 함께 표시한다. lead 미정이어도 확인된 복수 indication은 `Unknown`으로 축약하지 않는다.
- indication 필터를 다중 선택으로 변경했다. 선택한 indication 중 하나라도 레코드의 canonical indication 목록에 있으면 표시하고, `Unknown`은 확인 가능한 canonical indication이 전혀 없는 레코드만 대상으로 한다.
- 입력 GPT 지침에 lead 미정 시 상세 wording과 `indication_list`를 보존하라는 안내를 추가했다.

## 검증

- `canonicalize_indication_list([], "Focal onset seizure; major depressive disorder; pain", "Unknown")`이 Epilepsy/MDD/Pain 세 항목을 보존함을 확인했다.
- lead가 있는 Parkinson's disease + pain 사례에서 lead와 추가 indication이 함께 보존됨을 확인했다.
- JSON schema 파싱 및 `git diff --check`를 통과했다.
