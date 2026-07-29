# Detail 페이지 정성 평가 기준 (Qualitative Review Criteria)

**버전: v1 (임시)** — 2026-07-28 도입. 아래 3개 기준은 연구자가 상세페이지 우측 패널에서
자유서술 코멘트("팀 코멘트")와는 별도로, 정해진 관점별로 의견을 남길 수 있도록 만든
임시 기준이다. 추후 실제 검토 프로세스에 맞춰 교체/확장될 예정이며, 기존 스코어링
7개 기준(`target_relevance` 등, `config/scoring_criteria/v3_2_full.md` 참고)과는
완전히 별개의 정성적 트랙이다.

이 기준을 변경할 때는 아래 두 곳도 함께 업데이트해야 한다 (동기화되지 않으면 기존
저장된 의견의 `criterion_id`가 더 이상 표시되지 않는다):

- `main.py`의 `QUALITATIVE_REVIEW_CRITERIA` 딕셔너리
- `src/detail.js`의 `qualitativeReviewCriteria` 배열

## 기준 목록

| id | 라벨 | 설명 |
|---|---|---|
| `efficacy` | Efficacy | % Reversal(정상군 대비 회복율) 및 SoC 대비 통계적 유의성(p-value) 있는 개선 우위를 확인한다. |
| `commercial_appeal` | Commercial | L-IN / L-OUT 파트너사 관점에서의 TPP 매력도, Unmet Need 충족 및 시장 차별성을 평가한다. |
| `execution_risk` | Dev. & Partnership Risk | 임상/안전성/CMC 진행 시 주요 리스크, 불확실성 및 Due Diligence(DD) 추가 확인 필요 사항을 정리한다. |

## 입력 방식

세 항목은 담당자가 직접 작성하는 수동 입력 영역이다. GPT 원문 리포트, 업로드 자료,
파이프라인 데이터 또는 OpenRouter를 이용해 내용을 자동 생성하거나 자동 입력하지 않는다.
이전에 저장된 규칙 기반 AI placeholder는 데이터 호환성을 위해 삭제하지 않지만 화면에는
표시하지 않는다.
