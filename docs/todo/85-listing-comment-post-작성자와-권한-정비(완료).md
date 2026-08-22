# 85. Listing Comment Post 작성자와 권한 정비

## 목표

- Tab 0에서 직접 작성하는 `Listing Comment Post`는 실제 관리자 이름을 작성자로 표시한다.
- 후보 목록 Upload의 일괄 입력 Comment는 `Tab 0 Team Review` 작성자로 표시한다.
- 일괄 입력 코멘트를 Tab 0에서 수정하면 해당 내용은 수정한 관리자 이름의 Listing Comment Post로 전환한다.
- Listing import와 Comment/Contact/Website 수정 API를 관리자 전용으로 제한하고, 비관리자 UI에는 작성 제어를 노출하지 않는다.

## 작업 순서

1. Listing metadata에 Comment 작성자·출처·시각을 보존하고, 일괄 입력/직접 수정의 병합 규칙을 분리한다.
2. Tab 0 Comment popover 문구를 `Listing Comment Post`로 통일하고 관리자 전용 작성 UI를 적용한다.
3. 교차 워크플로우 Comment 동기화가 저장된 작성자를 유지하도록 수정한다.
4. 스키마·문서·회귀 테스트를 갱신하고 검증한다.

## 완료 기준

- Upload Comment는 `Tab 0 Team Review`로, 직접 Post/수정은 로그인 관리자 이름으로 표시된다.
- 비관리자는 Listing import 및 metadata 변경 요청을 수행할 수 없다.
- Fast Triage/Full Scout에 이관된 Listing Comment도 같은 작성자를 표시한다.
