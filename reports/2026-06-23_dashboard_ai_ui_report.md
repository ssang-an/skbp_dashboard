# SKBP Pipeline Finder UI / AI Chat 고도화 작업 보고서

작성일: 2026-06-23  
대상: Dashboard, Detail page, AI chat drawer, Wiki viewer

## 1. 이번 작업의 핵심 요약

- 대시보드에서 score 분포, theme/country 분포, score 평균, 우선순위 후보를 한눈에 볼 수 있도록 시각화 영역을 확장했습니다.
- 파이프라인 테이블에 JSON 원본의 추가 필드를 사용자가 직접 선택해서 표시할 수 있는 컬럼 커스터마이즈 기능을 추가했습니다.
- 대시보드 AI chat을 GPT 스타일에 가깝게 개선했습니다: 스트리밍 응답, 로딩 상태, Markdown 렌더링, Wiki source chip, drawer 크기 조절, Enter 전송을 지원합니다.
- 대시보드 AI chat에 conversation session 관리를 추가했습니다. 브라우저 localStorage에 대화 기록이 저장되고, 새 대화 생성 / 대화 선택 / 대화 삭제가 가능합니다.
- 약물 상세 페이지 AI chat도 대시보드와 같은 UI 패턴으로 통일했습니다. context 카드, 예시 질문, 스트리밍 응답, Enter 전송, Markdown 렌더링, Wiki source chip, drawer 크기 조절이 동일하게 적용됩니다.
- Wiki link를 raw Markdown 파일로 직접 열지 않고, `/wiki-view`에서 보기 좋은 문서형 UI로 열리게 정리했습니다.
- OpenRouter 기반 AI는 `json` record와 `skbp_pipeline_wiki` note를 함께 검색해 답변하도록 구성되어 있습니다. Free model rate limit 또는 API 오류가 있으면 local fallback 답변을 반환합니다.

## 2. 대시보드 UI 개선

### 추가된 시각화

- Target Relevance 분포
- Theme 분포
- 국가별 후보군 분포
- Hard Filter PASS / Other donut
- 7개 scoring criterion 평균 profile
- Priority Watch: total score 기준 상위 후보 리스트

### 테이블 개선

- 기본 테이블은 기존 핵심 컬럼 중심으로 유지했습니다.
- `컬럼 설정` 버튼을 통해 JSON 원본에 있는 추가 필드를 선택 표시할 수 있습니다.
- 추가 컬럼을 켠 경우 표가 지나치게 눌리지 않도록 table 최소 폭과 colgroup을 동적으로 조정했습니다.
- 선택 삭제, Excel export, 정렬, 필터링은 기존 흐름을 유지합니다.

## 3. AI Chat 개선

### 대시보드 AI chat

- 위치: 대시보드 우측 상단 `AI` 버튼
- 기능:
  - 스트리밍 응답
  - 답변 생성 중 로딩 UI
  - Enter 전송 / Shift+Enter 줄바꿈
  - Markdown 렌더링
  - Wiki source chip 표시
  - drawer 가로 사이즈 조절
  - 대화 세션 저장 / 선택 / 새 대화 / 삭제

대화 세션은 현재 서버 DB가 아니라 브라우저 localStorage에 저장됩니다. 공용 write 환경이나 팀 단위 공유 이력을 만들려면 추후 DB 기반 session table이 필요합니다.

### 약물 상세 AI chat

- 위치: detail page 우측 상단 `AI` 버튼
- 대시보드 AI chat과 같은 UI를 적용했습니다.
- 현재 asset, score context를 상단 카드로 보여줍니다.
- Target fit, Marketability, Evidence gap, Competitor risk 예시 질문을 제공합니다.

## 4. Wiki 기반 탐색 구조

- `skbp_pipeline_wiki` 폴더의 Markdown note를 검색합니다.
- 서버의 `search_wiki_notes()`가 질문, record context, dashboard context를 기반으로 관련 note를 찾습니다.
- AI prompt에 상위 wiki snippet을 삽입해 답변의 근거로 사용합니다.
- source chip 클릭 시 `/wiki-view?path=...`로 열어 raw file 대신 문서형 화면에서 볼 수 있습니다.

검증 결과:

- `/api/records` 응답: 정상
- `/wiki-view` 응답: 정상
- `search_wiki_notes("Neuroimmune data maturity marketability competitor")`: wiki note 3건 반환 확인
- `main.py` Python compile: 정상
- `src/app.js`, `src/detail.js` JavaScript syntax check: 정상

## 5. OpenRouter / AI 동작 관련 주의점

- `.env`에 `OPENROUTER_API_KEY`가 있어야 실제 AI 응답을 호출합니다.
- 현재 free model은 upstream rate limit 또는 일일 제한으로 429가 발생할 수 있습니다.
- 429 또는 API 오류 시 local fallback 답변이 반환됩니다.
- 답변이 중간에 끊기는 문제를 줄이기 위해 stream endpoint와 `OPENROUTER_MAX_TOKENS` 기반 제한을 사용합니다.
- 긴 record 전체를 매번 보내기보다 dashboard summary + anchor record + wiki snippet 중심으로 context를 줄여 토큰 낭비를 완화했습니다.

## 6. 사용 방법

서버 실행:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

브라우저:

```text
http://127.0.0.1:8000
```

AI chat:

- 대시보드: 우측 상단 `AI`
- 상세 페이지: 우측 상단 `AI`
- Enter: 전송
- Shift+Enter: 줄바꿈
- drawer 왼쪽 핸들 드래그: 채팅창 폭 조절

## 7. 다음에 하면 좋은 일

- 팀 공용 write 환경을 위해 PostgreSQL 또는 SQLite 기반 DB 저장 구조 도입
- Gmail / Google OAuth 로그인과 인증 사용자 제한
- AI chat session을 localStorage가 아니라 DB에 저장
- OpenRouter free model 대신 안정적인 유료 또는 BYOK provider 설정
- Wiki search를 단순 keyword 검색에서 embedding 기반 retrieval로 고도화
- scoring evidence에 대한 자동 source quality check 추가

