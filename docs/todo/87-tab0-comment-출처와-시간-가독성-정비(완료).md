# 87. Tab 0 Comment 출처와 시간 가독성 정비

## 목표

- Tab 0 Comment 피드를 `Tab 0 · Team Comment · 작성자 · 현지 날짜/시간` 또는 관리자 Listing Comment 형식으로 표시한다.
- Excel 일괄 업로드 Comment는 `Team Comment`, 이후 관리자 수정 Comment는 관리자 작성 Listing Comment로 분명히 구분한다.
- ISO/UTC 원문 시간을 일반 사용자가 읽을 수 있는 한국어 날짜·시간 표기로 바꾼다.

## 작업 순서

1. 저장된 Comment 출처를 기준으로 Tab 0 피드 source label을 만든다.
2. 피드의 모든 timestamp를 공통 한국어 형식으로 렌더링한다.
3. 회귀 테스트와 작업 로그를 갱신한다.
