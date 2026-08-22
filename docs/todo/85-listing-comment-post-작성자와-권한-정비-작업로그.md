# 85. Listing Comment Post 작성자와 권한 정비 — 작업 로그

## 2026-08-22

- 후보 목록 Upload에서 들어온 Listing Comment의 작성자를 `Tab 0 Team Review`로 저장하도록 했다.
- Tab 0에서 직접 작성하거나 기존 Listing Comment를 더블클릭해 수정하면 로그인한 관리자 이름과 작성 시각으로 덮어쓰도록 했다.
- Listing Comment Post popover와 Fast Triage·Full Scout 이관 Comment가 같은 작성자 정보를 표시하도록 했다.
- Listing import와 Comment/Contact/Website metadata 수정 API를 관리자 전용으로 제한했다.
- `tests/test_step0_pipeline_metadata.py`, Python 컴파일, JavaScript 구문 검사를 통과했다.
