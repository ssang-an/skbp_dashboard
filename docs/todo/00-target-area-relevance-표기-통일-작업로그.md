# Target Area Relevance 표기 통일 작업 로그

- 완료일: 2026-08-19
- 범위: Dashboard Tab1·Tab2 판단근거, Tab3 및 상세 점수 표시

## 적용 내용

- 사용자에게 표시되는 `Target Relevance`를 `Target Area Relevance`로 통일했다.
- 판단근거의 평가 조건·점수 기준과 rubric 버전은 변경하지 않았다.
- 내부 JSON 키 `target_relevance`, 점수 계산, AI 프롬프트 및 기준 문서는 호환성을 위해 유지했다.
- Dashboard 테이블 툴팁, Team Review/상세 화면, CSV 내보내기 헤더도 동일한 표시명을 사용한다.

## 검증

- Tab1·Tab2 판단근거 및 표기 관련 정적 테스트 8건 통과
- `node --check src/app.js src/detail.js src/triage-detail.js`
