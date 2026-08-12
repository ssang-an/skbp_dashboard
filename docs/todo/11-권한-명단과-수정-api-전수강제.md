# 11. 권한 명단과 수정 API 전수 강제

## 목표

초기 관리자 identity를 원문 명단과 일치시키고, 일반 사용자에게 허용된 네 가지를 제외한 레코드 변경 API를 admin/developer로 일관되게 제한한다.

## 작업

- `정영찬`/`alex_jeong` identity를 수정하고 allowlist의 이름+email local-part 검증 테스트를 추가한다.
- 레코드 삭제, 구조화 데이터 수정, score/filter/stage/target 수정, focus settings 등 mutating endpoints를 권한 매트릭스로 점검한다.
- user에게 허용된 report memo, AI chat, Team Review 정성 코멘트, Tab1/2 upload만 유지한다.
- 안전하지 않은 평문 비밀번호 조회 대신 developer password reset과 로그인 도움말을 구현한다.

## 완료 기준

- 지정 초기 identity와 role hierarchy 테스트가 통과한다.
- 수정 API가 user 직접 호출로 우회되지 않는다.
- 비밀번호 평문은 저장·응답·UI에 존재하지 않는다.
