# 09. ADMET 점수 분리와 회귀 방지 구현

## 목적

Tab 3에서 In vivo/In vitro 지표의 원천과 ADMET 점수의 원천을 완전히 분리하고, canonical 25-study 기준의 ADMET 완료율을 구현한다.

## 작업

- 먼저 Full Scout/CDP/NCDP 기반 In vivo·In vitro 상태와 ADMET 업로드 파서 상태가 각각 어느 필드에 저장되는지 추적해 이 파일 하단에 source-of-truth 표를 작성한다.
- ADMET 파일에서 행/열 위치 대신 Study–Status 의미 관계를 찾아 파싱하고, Category/header는 study로 세지 않는다.
- canonical 25-study 매핑과 study 이름 정규화를 구현하여 형식·괄호·공백 차이의 중복 카운트를 막는다.
- `Y`, `Complete`, `Completed`, 완료 표현은 case-insensitive로 완료 처리하되 `Not Completed`, `Incomplete`, N, 계획, 빈 값 등 부정 표현을 먼저 제외한다.
- Dog Telemetry 등 optional study는 별도 정보로 보존하되 분자/분모에 넣지 않는다.
- ADMET 파일이 없으면 `ADMET: -` 등 기존 missing-data 관례를 사용하고 Full Scout 지표는 계속 표시한다.
- UI를 `In vitro`, `In vivo`, `ADMET: completed / 25`로 독립 표시한다.
- 요청된 Case A~G와 파일 교체 회귀 테스트를 추가한다.

## 완료 기준

- ADMET 업로드/교체가 기존 In vivo/In vitro 값을 덮어쓰지 않는다.
- ADMET 분자는 항상 0~25의 고유 standard study 완료 수다.
- Format A/B, 부정 표현, optional study가 모두 검증된다.
- 단일 목적 Git 커밋을 남긴다.

## Source-of-truth 검토

_미작성 — 이 파일만 열어 구현을 시작할 때 먼저 작성._
