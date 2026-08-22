# 75. Tab 0 표 통일과 Listing 직접수정 (완료)

- Tab 0의 헤더·표 값·상태 pill을 Tab 1·2의 중립적인 테이블 타이포그래피와 맞췄다.
- Listing 대기 행은 관리자만 더블클릭 또는 키보드로 Company, Country, Asset, Modality, Target, Main indication, Stage를 수정할 수 있다.
- 수정된 Listing 값은 `candidate-queue.json`의 `manual_fields`에 편집자·시각과 함께 남고, 표에서는 굵기만으로 절제해 표시한다.
- Fast Triage/Full Scout가 완료된 행은 Tab 0에서 공식 조사값을 수정할 수 없으며, 클릭하면 해당 Tab으로 이동하는 안내 모달이 열린다.
- Contact의 기록 없음 dash도 Listing/Fast Triage/Full Scout/Shortlisting의 dash pill과 같은 형식으로 통일했다.
