# SKBP Pipeline Finder v3.7 — Fast Triage Criteria

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
| **SELECT** | `identity_verified = true`, `development_stage`가 `Discontinued / inactive`가 아니며, `TR >= 3`, `MoA >= 1`, 그리고 `Data >= 2` |
| **REJECT** | Identity가 확인되고 `development_stage`가 `Discontinued / inactive`가 아니며 TR/MoA/Data가 모두 1점 이상이지만 SELECT 조건을 충족하지 못함 |
| **INSUFFICIENT** | Asset identity 미확인, 또는 `development_stage`가 `Discontinued / inactive`로 확인되어 조기 종료했거나, identity 확인 후 TR/MoA/Data 중 하나가 0점 |

Target, MoA, indication 또는 stage만 미확인인 경우에는 해당 field를 `Unknown`으로 기록하고 scoring을 계속한다. Identity 미확인·`Discontinued / inactive` 조기 종료는 Markdown 점수를 `—`로 표시하며, JSON의 0점은 schema placeholder일 뿐 완료 평가 점수가 아니다.

Asset의 활동 여부를 위한 별도 필드는 없다. `structured_table.development_stage`가 유일한 판단 기준이며, `Discontinued / inactive`로 확인되면 조기 종료하고, 그 외 canonical stage 또는 `Unknown`(활동 여부를 확정할 수 없는 경우 포함)이면 TR/MoA/Data 채점을 정상 진행한다. `Unknown`은 SELECT/REJECT/INSUFFICIENT 판정에 관여하지 않고 참고정보로만 노출된다.

## SKBP Interest Indications

- Alzheimer's disease
- Parkinson's disease
- Amyotrophic lateral sclerosis / motor neuron disease
- Multiple sclerosis / neuroinflammatory disease
- Neuropathic pain
- Epilepsy / seizure disorders

TR 평가에는 확인된 가장 구체적인 indication wording을 사용한다. Neuropathic pain 및 명확한 subtype/synonym은 6개 interest indication으로 TR 3점에 해당한다. `Pain`만 확인되거나 acute/postoperative/non-neuropathic pain이면 넓은 SKBP pain 범위 내의 비우선 indication으로 TR 2점에 해당한다.

## R&D Theme Taxonomy

- `E/I Balance`
- `Neuroimmune`
- `Protein Homeostasis`

Theme은 조사로 확인한 assessed asset의 target/MoA가 직접 연결될 때만 매핑한다. `Protein Homeostasis`는 protein folding/chaperone, ubiquitin-proteasome, autophagy-lysosome, ER stress/UPR 또는 pathogenic aggregate clearance를 직접 조절하는 경우에 한한다. 질환에 단백질 응집이 존재한다는 사실만으로는 해당 Theme을 부여하지 않는다. Protein Homeostasis의 하위 Cluster taxonomy는 아직 승인되지 않았으므로 Cluster는 `Unknown`을 사용한다.

## Scoring Table

각 criterion은 서로 독립적으로 평가하고 `0`, `1`, `2`, `3` 중 하나의 단일 정수만 부여한다.

| Criterion | Parameter definition | 0점 | 1점 | 2점 | 3점 |
|---|---|---|---|---|---|
| **Target Relevance** | 확인된 asset의 indication이 SKBP 전략 범위와 얼마나 맞는지 평가합니다. Theme/Cluster와 disease biology 연결성은 별도 분류 및 MoA 평가에 사용합니다. | Identity 확인 후에도 indication/relevance 판단 정보 부족 (identity 미확인은 조기 종료) | SKBP의 넓은 신경계·정신과·신경면역·신경퇴행·통증 범위 밖 | 넓은 SKBP 범위에는 속하지만 6개 우선 적응증 밖 | 6개 SKBP 우선 적응증 중 하나에 해당 |
| **MoA Validity** | 작용기전이 얼마나 구체적으로 정의되어 있고, 이를 뒷받침하는 기능적·과학적 근거가 어느 수준인지 평가합니다. | Target 또는 작용기전을 확인할 수 없어 평가 불가 | 작용기전 설명은 있으나 회사 주장 또는 이론적 근거 중심 | 기전이 실제로 작동함을 보여주는 기능적 실험 또는 동일 target/class의 독립 검증 근거 있음 | 해당 asset에서 target engagement, mechanism-linked PD/biomarker 또는 직접적인 작용기전 검증이 확인됨 |
| **Data Maturity** | 해당 asset의 개발 단계에 맞는 공개 데이터가 얼마나 충분하고 해석 가능한지 평가합니다. | 공개된 asset-specific 결과 없음 | 정성적 claim 또는 단편적 결과만 있어 개발 단계 대비 불충분 | 개발 단계에 맞는 해석 가능한 정량적 evidence domain이 1개 이상 공개 | 상호보완적·stage-appropriate 정량 evidence domain이 2개 이상이고, 그중 최소 1개가 program progression을 직접 지지 |

### Target Relevance decision order

항상 높은 점수부터 판정하며 여러 조건에 해당하면 가장 높은 적용 가능 점수 하나만 부여한다.

- **3점:** 확인된 상세 indication이 6개 SKBP 우선 적응증 중 하나다.
- **2점:** 확인된 상세 indication은 넓은 SKBP 신경계·정신과·신경면역·신경퇴행·통증 범위에 속하지만 6개 우선 적응증에는 해당하지 않는다.
- **1점:** asset identity와 indication은 확인됐지만 넓은 SKBP 범위 밖이다.
- **0점:** identity가 확인된 뒤에도 indication/relevance를 평가할 수 있는 최소 정보가 없을 때만 부여한다. 이 경우 status는 INSUFFICIENT다.

Asset identity 자체를 확인할 수 없으면 TR 0점 평가 대신 INSUFFICIENT 조기 종료를 사용한다. Target/MoA의 질환 biology 연결성은 TR 점수에 반영하지 않는다.

### MoA evidence definitions

- **Functional evidence:** target/pathway 조절 뒤 예상되는 functional 또는 downstream biological effect가 실험에서 확인됨.
- **Same target/class validation:** 다른 약물, 독립 연구 또는 동일 class에서 target/mechanism이 검증됨.
- **Asset-specific validation:** 평가 asset 자체에서 target engagement, mechanism-linked PD/biomarker 또는 직접 functional effect가 확인됨.

일반 clinical efficacy만으로 3점을 주지 않는다. Clinical evidence를 쓰려면 proposed mechanism과 연결된 mechanism-linked clinical PoC여야 한다.

### MoA investigation-note context (v3.7)

MoA Validity 2~3점에서는 `investigation_note`에 이미 점수 산정 과정에서 확인된 근거가 disease-relevant phenotype·efficacy·biomarker와 연결되는지, 또는 세포신호 marker 등 proximal 지표에 그치는지를 한 문장 이내로 기록한다. MoA 0~1점에는 이 구분을 쓰지 않는다. 기존 근거만으로 구분할 수 없으면 `확인 불가`로 기록하며, 추측하거나 이 문장을 위해 새 검색을 수행하지 않는다. 이 규칙은 evidence context 기록용이며 MoA 점수 정의를 변경하지 않는다.

Use only existing scoring evidence; do not infer or perform a new search for this note.

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
- Clinical unspecified
- Phase 1
- Phase 1/2
- Phase 2
- Phase 2/3
- Phase 3
- Registration
- Approved / marketed
- Discontinued / inactive
- Unknown

확인된 명시적 stage 표현 또는 완료·착수된 milestone만 canonicalize한다. 계획·예상·목표, 투자 유치, 채용공고만으로 현재 stage를 추론하지 않는다. `preclinical`만 확인되면 `Preclinical unspecified`, candidate nominated/selected면 `Preclinical Candidate`, 실제 GLP tox/IND-directed CMC/IND-enabling study가 진행 중이면 `IND-enabling`, IND/CTA가 submitted/filed/accepted/effective/cleared면 `IND filed/cleared`를 쓴다. 시작·진행 중인 clinical/pivotal/registrational trial에서 phase가 확인되지 않으면 `Clinical unspecified`이며, pivotal/registrational만으로 `Phase 3`를 추론하지 않는다. `suspended`/`halted`는 pause signal이므로 `Discontinued / inactive`로 내리지 않는다 — 확인된 가장 최근 canonical stage를 유지하고 Markdown에 pause 상태와 근거를 기록한다. Stage를 확인할 수 없거나 상충을 해소할 수 없으면 `Unknown`과 uncertainty를 기록한다.
