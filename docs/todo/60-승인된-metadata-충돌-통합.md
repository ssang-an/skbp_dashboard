# 60. 승인된 Metadata 충돌 통합

## 목적

회사 PC와 집 PC의 실제 Pipeline 충돌 중, 원문 리포트·점수와 무관한 attachment 및 audit metadata를 데이터 유실 없이 통합한다.

## 승인된 정책

- 현재 원격 record의 원문 리포트, 점수, 사람 점수 override를 기본으로 유지한다.
- `attachments`, `edit_history`, `human_review.history`, Filter 3 document analysis는 중복 없이 union한다.
- 관련 timestamp는 더 늦은 값을 사용한다.
- Git 공통 기준이 없는 record도 primary 내용은 현재 원격본으로 유지한다.

## 완료 조건

- 명시적 opt-in CLI option으로만 정책 병합을 수행한다.
- metadata union 및 common-base 없는 primary 보존을 회귀 테스트한다.
