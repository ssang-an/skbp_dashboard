# 59. Stash 필드 단위 3-way 병합 작업 로그

## 구현

- `stash@{n}^1`의 JSON을 공통 기준으로 읽어 current/stash/base 3-way 비교를 수행한다.
- 서로 다른 필드만 수정된 record는 `automatically_merged`로 기록하고 안전 write 대상에 포함한다.
- 동일 필드 충돌은 `conflicts[].field_paths`에 경로를 남기고 write를 차단한다.
- attachment, history, source 배열은 자동 병합하지 않고 충돌로 유지한다.

## 검증

- 6개 회귀 테스트 통과
- stash 전용·동일 record·record 전체 충돌·비중첩 3-way 결합·동일 필드 충돌·write 전 백업 검증
