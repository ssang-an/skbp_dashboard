# 63. Tab 0 Listing 메타데이터와 단계 표시 작업 로그

- Listing 대기열(`json/candidate-queue.json`)을 조사 전 원본으로 유지하고, 조사 완료 시 같은 asset/company identity의 `meta.pipeline_metadata`로 승격하도록 구현했다.
- `comment`, `contact`는 내부 운영 메타데이터이며 GPT 원문·출처·점수·루브릭에 전달하지 않는다.
- 빈 Excel 셀은 기존 Comment/Contact를 보존하고, Tab 0 편집 UI에서 빈 값으로 저장한 경우만 명시적 삭제로 처리한다.
- Tab 0의 기존 `조사 대기` 표기는 사용자 흐름에 맞춰 `Listing`으로 변경했다.
- Listing 도입 전 조사 완료 레코드는 진행 표에서 Listing 완료로 표시한다.
