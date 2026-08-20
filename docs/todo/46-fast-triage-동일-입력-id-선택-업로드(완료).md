# 46. Fast Triage 동일 입력 ID 선택 업로드 (완료)

## 반영 내용

- `/api/records/validate`가 정규화된 중복 저장 ID와 해당 입력 행 번호를 반환한다.
- 업로드 검토 모달에서 동일 입력 ID 그룹은 자동 병합하지 않고, 사용자가 `이 항목 유지`로 한 행을 선택하도록 표시한다.
- 선택하지 않은 행만 이번 저장에서 제외하고, 선택 행은 기존 Pipeline 덮어쓰기 검토까지 이어진다.
- `/api/records`의 직접 저장 중복 차단은 유지했다.
- 사용자 화면에서는 기술적인 저장 ID 대신 `동일 Pipeline 후보`라는 문구로 안내한다.

## 검증

- `python -m unittest tests.test_data_reupload tests.test_compact_ingestion`
- `node --check src/app.js`
- `python -m py_compile main.py`
