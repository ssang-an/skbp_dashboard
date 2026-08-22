# 70. 다중 Indication 정규화와 OR 필터 복원 (완료)

- 확인된 다중 indication은 canonical library의 원문 순서로 `indication_list`에 저장·표시한다.
- 공식 lead가 없으면 첫 canonical indication을 Main indication으로 표시하며, 값이 하나도 확인되지 않을 때만 `Unknown`을 쓴다.
- indication filter는 선택한 항목 중 하나라도 해당하면 보이는 OR 조건을 유지했다.
- GPT 지침·서버 정규화·schema 설명·회귀 테스트를 같은 규칙으로 동기화했다.
