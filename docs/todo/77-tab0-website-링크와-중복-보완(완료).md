# 77. Tab 0 Website 링크와 중복 보완 (완료)

- Website는 Tab 0 Progress 표의 맨 오른쪽에 외부 링크 pill로 표시된다.
- URL 셀에 여러 주소가 있어도 첫 번째 유효한 `http(s)` URL만 저장한다.
- 기존 Listing 중복은 빈 필드를 채우며, 신규 행이 더 많은 Listing 정보를 포함할 때에만 충돌하는 Listing 값을 교체한다.
- Fast Triage/Full Scout가 존재하는 동일 항목은 공식 조사값을 계속 우선하며, Listing Website는 사용자 제공 탐색 힌트로만 보존한다.
