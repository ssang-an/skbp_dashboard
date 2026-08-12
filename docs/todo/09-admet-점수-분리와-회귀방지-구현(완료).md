# 09. ADMET 점수 분리와 회귀 방지 구현

## Source-of-truth 검토

| 표시 | source of truth | 저장 필드 |
| --- | --- | --- |
| In vivo / In vitro | Full Scout 원문과 CDP/NCDP 첨부의 evidence detection | `focus_management.in_vivo_status`, `in_vitro_status` |
| ADMET | filename이 ADMET으로 분류된 업로드의 Study–Status 완료 행 | `focus_management.admet_completed` |

## 완료 내용

- ADMET attachment는 In vivo/In vitro evidence input에서 제외했다. ADMET 교체가 기존 Full Scout/CDP/NCDP indicator를 덮어쓰지 않는다.
- ADMET parser는 pipe/tab 형식과 줄바꿈 형식의 Study→Status 관계를 읽고, category/header는 제외하며 unique study만 0~25 범위에서 집계한다.
- `Y`, `Complete`, `Completed`, 완료 표현만 완료로 처리하며 Not Completed, Incomplete, N, 계획, 예정, 진행 중, 필요 표현은 먼저 제외한다.
- Dog Telemetry는 optional study로 제외한다. Dashboard denominator와 manual input validation은 25로 통일했다.

## 검증

- pipe/tab 및 multiline 형식에서 Mouse PK/Rat PK 완료 2건, Dog Telemetry와 Not Completed 제외를 Python assertion으로 확인했다.
- Python compile 및 `git diff --check`를 실행했다.
