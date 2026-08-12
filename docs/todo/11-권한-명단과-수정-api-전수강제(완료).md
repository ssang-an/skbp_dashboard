# 11. 권한 명단과 수정 API 전수 강제

## 완료 내용

- 초기 admin identity의 `정영찬`/`alex_jeong` 오기를 수정했다.
- developer-only password reset API를 추가했다. 새 hash/salt만 저장하고 sessions를 무효화하며 평문을 반환하지 않는다.
- candidate queue 삭제, record bulk/individual 삭제, rubric/OI 재계산, focus-management, attachment 삭제, qualitative criteria 및 AI generation, record replacement에 admin/server authorization을 추가했다.
- 일반 로그인 사용자가 허용된 업로드·comment·topic note 경로는 유지했다.
