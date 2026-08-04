# Detail 페이지 정성 평가 기준 (Qualitative Review Criteria)

**버전: v2** — 2026-08-01 개정. 아래 3개 기준은 연구자가 상세페이지 우측 패널에서
자유서술 코멘트("팀 코멘트")와는 별도로, 정해진 관점별로 의견을 남길 수 있도록 만든
기준이다. 기존 스코어링 7개 기준(`target_relevance` 등,
`config/scoring_criteria/v3_3_full.md` 참고)과는 완전히 별개의 정성적 트랙이다.

이 3개 기준을 변경할 때는 아래 두 곳도 함께 업데이트해야 한다 (동기화되지 않으면 기존
저장된 의견의 `criterion_id`가 더 이상 표시되지 않는다):

- `main.py`의 `QUALITATIVE_REVIEW_CRITERIA` 딕셔너리
- `src/detail.js`의 `qualitativeReviewCriteria` 배열

담당자가 상세페이지에서 직접 등록하는 **추가 항목**(레코드별 custom criteria)은 이
파일이 아니라 각 레코드의 `meta.qualitative_review.custom_criteria`에 저장되며, 동기화
대상이 아니다.

상세페이지의 추가 폼은 다른 레코드에 저장된 custom criteria를 추천할 수 있다.
`GET /api/records/{id}/qualitative-review/criteria/suggestions`가 현재 레코드에 없는 항목을
제목·설명 기준으로 묶어 반환하며, 가져오기는 제목과 설명만 새 로컬 항목으로 복제한다.
기존 의견은 복사하지 않고 출처는 `imported_from_record_id`와
`imported_from_criterion_id`에 기록한다.

## 기준 목록 (고정 3종)

| id | 라벨 | 설명 |
|---|---|---|
| `efficacy` | Efficacy | % Reversal(정상군 대비 회복율) 및 SoC 대비 통계적 유의성(p-value) 있는 개선 우위를 확인한다. |
| `commercial_appeal` | Commercial | L-IN / L-OUT 파트너사 관점에서의 TPP 매력도, Unmet Need 충족 및 시장 차별성을 평가한다. |
| `execution_risk` | Dev. & Partnership Risk | 임상/안전성/CMC 진행 시 주요 리스크, 불확실성 및 Due Diligence(DD) 추가 확인 필요 사항을 정리한다. |

## 추가 항목 (custom criteria)

고정 3종 아래 "+ 새 평가 항목 추가" 버튼으로 담당자가 레코드별로 항목(제목 +
설명/질문)을 직접 등록할 수 있다. 등록/삭제는
`POST` / `DELETE /api/records/{id}/qualitative-review/criteria(/{criterion_id})`가
처리하며, 레코드당 최대 10개까지 등록 가능하다. 등록된 항목은 고정 3종과 동일한 방식
(수동 입력 + AI 생성)으로 동작한다.

## 입력 방식

각 항목은 담당자가 직접 작성하는 수동 입력을 기본으로 하되, 항목별 "✨ AI 생성" 버튼을
누르면 OpenRouter가 해당 레코드의 GPT 원문 리포트(`source_report.raw_markdown`)와
업로드된 자료(`meta.attachments`에서 추출한 텍스트)만을 근거로 1차 초안을 작성해
자동으로 등록한다. AI가 생성한 의견은 `is_ai: true`, `author: "AI"`로 저장되며 화면에
**`[AI]` 배지**로 표시되어 사람이 작성한 의견과 항상 구분된다 — 담당자는 이 초안을
검토·수정하거나 그대로 삭제할 수 있다. 근거가 불충분하면 AI는 추측 대신 부족한 근거를
명시하도록 프롬프트에 지시되어 있다.

이전에 저장된 규칙 기반 AI placeholder(author: `AI (초안)`, OpenRouter 미사용 고정
문구)는 데이터 호환성을 위해 삭제하지 않지만 화면에는 계속 표시하지 않는다.
