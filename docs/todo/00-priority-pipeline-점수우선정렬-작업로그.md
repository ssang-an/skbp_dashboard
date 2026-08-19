# 00. Priority Pipeline 점수 우선 정렬 작업 로그

## 반영 내용

- Tab2 Priority Pipeline은 `Total score` 내림차순으로 먼저 정렬한다.
- 점수가 같은 pipeline만 최신 조사일(`completed_at`, legacy fallback `generated_at`)이 앞에 오도록 정렬한다.
- 서버 Dashboard Summary와 네트워크 오류 시 사용하는 브라우저 fallback에 같은 우선순위를 적용한다.

## 검증

- 서버 Summary의 점수·동점 최신 조사일 정렬 회귀 테스트와 화면 정렬 규칙 정적 테스트를 실행한다.
