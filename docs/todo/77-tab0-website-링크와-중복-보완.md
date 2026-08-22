# 77. Tab 0 Website 링크와 중복 보완

## 범위

- Tab 0 Listing 입력과 Progress 표에 Website를 추가한다.
- Excel의 Website/URL/Homepage 열에서 첫 번째 `http(s)` URL만 저장하고 외부 링크 pill로 연다.
- 같은 Listing이 다시 업로드되면 비어 있는 필드는 보완하고, 새 행이 더 완전할 때만 충돌 필드를 교체한다.

## 검증

- Website URL 정규화, 중복 병합 규칙, 기존 Tab 0 metadata 테스트를 실행한다.
