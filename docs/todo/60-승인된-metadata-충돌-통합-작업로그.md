# 60. 승인된 Metadata 충돌 통합 작업 로그

## 구현

- `--resolve-approved-metadata-conflicts`를 추가했다.
- 현재 record의 report/scoring을 유지한 채 metadata 목록을 canonical JSON 기준으로 중복 제거해 합친다.
- human review 관련 actor/source는 선택된 최신 timestamp와 같은 쪽의 값으로 유지한다.
- `local-backups/`를 Git ignore 처리해 로컬 병합 백업이 이후 `git status`를 더럽히지 않게 했다.

## 검증

- 8개 회귀 테스트 통과
- metadata audit history union 및 common-base 없는 primary 유지 검증
