# SKBP Pipeline Finder v3.3 — Fast Triage Criteria

## Purpose

Fast Triage는 확인 가능한 biotech/pharma pipeline asset을 빠르게 선별해 Full Scout 심층 검토 대상으로 보낼지 결정한다. 최종 BD recommendation이 아니다.

## Evidence Discipline

Use only asset-specific facts explicitly provided by the user or verified from credible public sources.

Canonicalize confirmed facts into approved dashboard values, but do not infer unconfirmed facts or completed/current status from plans, expectations, financing, hiring activity, adjacent programs, class assumptions, or general scientific knowledge.

General scientific knowledge may only be used to map confirmed facts to the scoring rubric. If a fact cannot be established or conflicting sources cannot be resolved, use Unknown and record the uncertainty.

이 원칙은 모든 factual field와 scoring criterion에 적용한다. 사용자가 제공한 사실과 GPT가 실제로 확인한 공개자료를 구분하고, URL이 제공되었더라도 내용을 확인하지 않았다면 verified public source로 계산하지 않는다.

## Final Status

| Status | Rule |
|---|---|
| **SELECT** | `identity_verified = true`, active asset, `TR >= 2`, 그리고 `MoA >= 2` 또는 `Data >= 2` |
| **REJECT** | Identity는 확인됐지만 SELECT 조건을 충족하지 못했거나 inactive/discontinued/terminated/withdrawn/suspended/dormant/clearly failed hard blocker가 확인됨 |
| **UNVERIFIED** | 공개 자료에서 특정 biotech/pharma pipeline asset으로 identity를 확인할 수 없음 |

Target, MoA, indication 또는 stage만 미확인인 경우에는 해당 field를 `Unknown`으로 기록하고 scoring을 계속한다. Target/MoA와 indication의 relevance 문제는 UNVERIFIED가 아니라 Target Relevance 기준으로 평가한다.

`triage.active_asset`은 항상 포함한다. 공개 근거로 active 상태를 확인했을 때만 `true`, inactive 상태를 확인했을 때 `false`, 현재 activity를 확정할 수 없을 때 `null`을 사용한다. SELECT는 `active_asset = true`일 때만 가능하다.

## SKBP Interest Indications

- Alzheimer's disease
- Parkinson's disease
- Amyotrophic lateral sclerosis / motor neuron disease
- Multiple sclerosis / neuroinflammatory disease
- Neuropathic pain
- Epilepsy / seizure disorders

TR 평가에는 확인된 가장 구체적인 indication wording을 사용한다. Neuropathic pain 및 명확한 subtype/synonym은 interest indication에 해당한다. `Pain`만 확인되고 subtype을 알 수 없거나 acute/postoperative/non-neuropathic pain이면 TR 1 기준을 적용한다.

## R&D Theme Taxonomy

- `E/I Balance`
- `Neuroimmune`
- `Protein Homeostasis`

Theme은 조사로 확인한 assessed asset의 target/MoA가 직접 연결될 때만 매핑한다. `Protein Homeostasis`는 protein folding/chaperone, ubiquitin-proteasome, autophagy-lysosome, ER stress/UPR 또는 pathogenic aggregate clearance를 직접 조절하는 경우에 한한다. 질환에 단백질 응집이 존재한다는 사실만으로는 해당 Theme을 부여하지 않는다. Protein Homeostasis의 하위 Cluster taxonomy는 아직 승인되지 않았으므로 Cluster는 `Unknown`을 사용한다.

## Scoring Table

각 criterion은 서로 독립적으로 평가하고 `0`, `1`, `2`, `3` 중 하나의 단일 정수만 부여한다.

| Criterion | Parameter definition | 0점 | 1점 | 2점 | 3점 |
|---|---|---|---|---|---|
| **Target Relevance** | SKBP 우선 관심 적응증 및 R&D Theme/Cluster와의 적합성을 평가합니다. | SKBP 관련성을 판단할 정보가 부족하거나 관심 질환 범위 밖 | 신경계·신경면역·신경퇴행·통증 관련 질환이지만 SKBP 우선 관심 적응증에는 해당하지 않음 | SKBP 우선 관심 적응증에 해당 | SKBP 우선 관심 적응증에 해당하며, target/MoA가 해당 질환 biology 또는 SKBP Theme/Cluster에 직접 연결 |
| **MoA Validity** | 작용기전이 얼마나 구체적으로 정의되어 있고, 이를 뒷받침하는 기능적·과학적 근거가 어느 수준인지 평가합니다. | Target 또는 작용기전을 확인할 수 없어 평가 불가 | 작용기전 설명은 있으나 회사 주장 또는 이론적 근거 중심 | 기전이 실제로 작동함을 보여주는 기능적 실험 또는 동일 target/class의 독립 검증 근거 있음 | 해당 asset에서 target engagement, mechanism-linked PD/biomarker 또는 직접적인 작용기전 검증이 확인됨 |
| **Data Maturity** | 해당 asset의 개발 단계에 맞는 공개 데이터가 얼마나 충분하고 해석 가능한지 평가합니다. | 공개된 asset-specific 결과 없음 | 정성적 claim 또는 단편적 결과만 있어 개발 단계 대비 불충분 | 개발 단계에 맞는 해석 가능한 정량적 evidence domain이 1개 이상 공개 | 개발 단계에 맞는 상호보완적 정량적 evidence domain이 2개 이상 공개 |

### Target Relevance decision order

항상 높은 점수부터 판정하며 여러 조건에 해당하면 가장 높은 적용 가능 점수 하나만 부여한다.

- **3점:** 확인된 상세 indication이 interest indication이고, target 또는 MoA가 해당 질환 biology나 SKBP R&D Theme/Cluster에 직접 연결된다.
- **2점:** 확인된 상세 indication이 interest indication이지만 direct biology fit이 확인되지 않았거나 근거가 불충분하다. Target/MoA가 undisclosed여도 상세 indication이 확인되면 가능하다.
- **1점:** interest indication 밖이지만 신경계·신경면역·신경퇴행·통증 관련 질환이거나, claimed interest indication과 공개 target/MoA가 명백히 무관하거나 과학적으로 모순된다.
- **0점:** indication·target·MoA가 부족해 relevance를 판단할 수 없거나 확인된 indication이 SKBP 관련 질환 범위 밖이다.

근거가 약하다는 이유만으로 TR 2를 낮추지 않으며, 공개 target/MoA가 명백히 무관하거나 과학적으로 모순될 때만 TR 1을 적용한다. Undisclosed target/MoA는 contradiction이 아니다.

### MoA evidence definitions

- **Functional evidence:** target/pathway 조절 뒤 예상되는 functional 또는 downstream biological effect가 실험에서 확인됨.
- **Same target/class validation:** 다른 약물, 독립 연구 또는 동일 class에서 target/mechanism이 검증됨.
- **Asset-specific validation:** 평가 asset 자체에서 target engagement, mechanism-linked PD/biomarker 또는 직접 functional effect가 확인됨.

일반 clinical efficacy만으로 3점을 주지 않는다. Clinical evidence를 쓰려면 proposed mechanism과 연결된 mechanism-linked clinical PoC여야 한다.

### Data evidence domains

Evidence domain은 서로 다른 개발 질문에 답하는 데이터 범주다. 예: in vitro activity/selectivity, target engagement/PD, in vivo efficacy, PK/PD, safety/tolerability, clinical outcome.

- 동일 underlying experiment의 endpoint, dose, figure 또는 동일 결과의 반복 source는 한 domain으로 계산한다.
- 하나의 공개 source에 서로 다른 개발 질문에 답하는 in vivo efficacy와 PK/PD 같은 결과가 함께 있으면 서로 다른 두 domain으로 평가할 수 있다.
- Potency와 selectivity는 하나의 in vitro characterization domain으로 계산한다.
- Data 3은 complementary, stage-appropriate domain이 최소 2개이고 그중 하나가 program progression을 직접 뒷받침해야 한다.
- Human data는 필수조건이 아니다.

## Criterion Evidence Basis

각 TR/MoA/Data criterion의 Markdown 판단근거에는 전체 `evidence_basis`와 조사 과정을 기록한다. Compact v2 JSON criterion에는 대시보드 표시용 `score`, `evidence_basis`, 짧은 판단 요약/why-not-higher/불확실성, 그리고 중앙 `source_registry`를 가리키는 `source_ids`만 저장한다.

| Value | Meaning |
|---|---|
| `user_input_only` | 사용자 입력정보만 사용 |
| `public_source` | GPT가 실제 확인한 공개자료만 사용 |
| `user_input_and_public_source` | 사용자 입력정보와 실제 확인한 공개자료를 함께 사용 |
| `no_supporting_basis` | 사용자 입력과 공개자료 어디에도 점수를 뒷받침할 근거가 없음 |

- TR은 사용자 입력정보 또는 공개자료로 preliminary scoring할 수 있다.
- MoA 2점 이상은 citable public technical source가 최소 1개 필요하다.
- Data 2점 이상은 asset-specific data를 확인한 public source가 최소 1개 필요하다.
- Source 수 자체는 점수를 결정하지 않는다.
- `score >= 2`와 `no_supporting_basis`의 조합은 invalid다.
- `public_source` 또는 `user_input_and_public_source`에는 verified source URL이 있어야 한다.
- Markdown References에서 public source로 계산되는 항목은 GPT가 실제로 연 http(s) URL이어야 한다. Bare URL 또는 열어보지 않은 사용자 제공 URL은 계산하지 않는다. Compact v2의 `structured_table.sources`는 `[]`로 유지하고, 대시보드 Source 열은 `validation.source_registry`에서 파생한다.

## Summary Rule

### Compact v2 score-prefix validation

`main_line_summary` must state its own selected score exactly once with a criterion label, preferably at the start: `TR N points:`, `MoA N points:`, or `Data N points:`. `N` must match that criterion's JSON `score` (0-3). Do not state another criterion's score in the summary. Quantitative evidence such as asset codes, percentages, ratios, sample sizes, trial phases, or decimal values is not a score and should remain concise here; place detailed evidence in the Markdown reasoning or audit fields.

Markdown의 각 criterion 판단 요약은 확인된 asset-specific 사실, 그 사실과 점수의 연결, 핵심 제한점을 1~2문장으로 쓴다. 일반 disease biology만으로 점수를 설명하지 않는다. `user_input_only`라면 사용자 입력에 없는 target, cell type, MoA 또는 data를 추가하지 않는다. 반드시 단일 점수를 `2점`처럼 명시하고 범위형 점수를 쓰지 않는다.

## Canonical Development Stage

`structured_table.development_stage`는 아래 값 중 정확히 하나만 사용한다.

- Hit Discovery
- Lead Optimization
- Preclinical Candidate
- IND-enabling
- Preclinical unspecified
- IND filed/cleared
- Phase 1
- Phase 1/2
- Phase 2
- Phase 2/3
- Phase 3
- Registration
- Approved / marketed
- Discontinued / inactive
- Unknown

확인된 명시적 stage 표현 또는 완료·착수된 milestone만 canonicalize한다. 계획·예상·목표, 투자 유치, 채용공고만으로 현재 stage를 추론하지 않는다. `preclinical`만 확인되면 `Preclinical unspecified`, candidate nominated/selected면 `Preclinical Candidate`, 실제 GLP tox/IND-directed CMC/IND-enabling study가 진행 중이면 `IND-enabling`, IND/CTA가 submitted/filed/accepted/effective/cleared면 `IND filed/cleared`를 쓴다. Stage를 확인할 수 없거나 상충을 해소할 수 없으면 `Unknown`과 uncertainty를 기록한다.
