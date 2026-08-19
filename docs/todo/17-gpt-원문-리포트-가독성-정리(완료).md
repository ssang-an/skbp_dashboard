# 17. GPT 원문 리포트 가독성 정리 (완료)

## 완료 내용

- Fast Triage·Full Scout 지침에 OpenAI 내부 인용 토큰, 브라우저 인용 ID, HTML 태그를 출력하지 않고 실제 URL Markdown References만 사용하도록 명시했다.
- 새로 붙여넣는 원문은 `:contentReference[oaicite:…]{…}` 및 독립 `oaicite` 표기를 제거하고 `<br>`을 Markdown 줄바꿈으로 변환한다. 업로드 검토 화면에 정리 건수도 안내한다.
- API 저장·상세 재업로드 경로에도 같은 정리 안전망을 적용했다.
- 기존 저장 JSON은 일괄 수정하지 않고, Full Scout/Fast Triage 원문 화면·팝업·복사 시 같은 정규화를 적용한다.
- 실제 URL 기반 Markdown References와 조사 본문은 그대로 유지한다.

## 검증

- `node --check src/app.js`
- `node --check src/detail.js`
- `node --check src/triage-detail.js`
- `.venv\\Scripts\\python.exe -m unittest tests.test_report_readability tests.test_compact_ingestion`
