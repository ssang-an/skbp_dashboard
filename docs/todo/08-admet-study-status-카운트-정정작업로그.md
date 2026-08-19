# 08. ADMET Study–Status 카운트 정정 작업 로그

## 반영 기준

- ADMET Partner Material에서 Study와 대응 Status를 읽어 완료된 canonical standard study 수만 센다.
- 표기는 언제나 `완료 Study 수 / 25`이며, Dog Telemetry 등 optional/additional study는 분자와 분모 모두에서 제외한다.
- Status가 `Y`, `Complete`, `Completed` 또는 `완료` 계열이면 완료로 처리하되, `Not completed`, `Incomplete`, `N`, 예정·진행 상태 등 부정 표현을 먼저 제외한다.

## 원인과 수정

- VTA-27의 PDF 표 기반 파서는 16개 완료 Study를 계산하고 있었지만, 완료된 DeepSeek 분석의 `admet_completed_count: null`이 그 값을 덮어써 Dashboard에 점수가 남지 않았다.
- ADMET attachment가 있으면 deterministic Study–Status 카운트를 항상 우선하도록 수정했다. 문서 모델 점수는 표를 읽을 수 없는 경우에만 보조값으로 사용한다.
- 기존 자동 분류도 새 ADMET 저장값으로 갱신되도록 OI Partnership criteria version을 v1.4로 올렸다.

## 검증

- canonical 25개·alias·multiline Status·부정/예정 Status·Dog Telemetry 제외·DeepSeek 빈 점수 fallback을 자동 테스트했다.
- VTA-27의 업로드 PDF에서 계산한 결과는 `16 / 25`다.
