# SKBP Pipeline Finder v3.1 — Full Scoring Criteria

## 0. Scoring Operating Principle

각 scoring criterion은 서로 독립적으로 평가한다.

- 공통 scoring rule은 사용하지 않는다.
- 한 criterion의 점수를 다른 criterion에 자동 반영하지 않는다.
- 모든 score는 반드시 `0`, `1`, `2`, `3` 중 하나의 단일 정수로 부여한다.
- `0~1`, `1~2`, `2~3` 같은 범위형 점수는 사용하지 않는다.
- 판단이 애매한 경우에도 가장 가까운 단일 score를 선택하고, 불확실성은 reason, investigation_note, uncertain_points에 기재한다.
- 모든 criterion에는 Evidence Type을 함께 표기한다.
- Evidence Type은 score를 자동 결정하는 rule이 아니라, 해당 score가 어떤 수준의 근거에 기반했는지 보여주는 audit label이다.

## 1. Evidence Type

| Evidence Type | Definition | Examples |
|---|---|---|
| **E0. Not found / Not assessable** | 신뢰 가능한 근거가 없거나 판단 불가 | target 미공개, MoA 미공개, 경쟁 정보 확인 불가 |
| **E1. Company claim or scientific rationale only** | 회사 주장, 과학적 논리, plausible rationale은 있으나 실험값/임상값은 공개되지 않음 | “BBB penetrant”, “highly selective”, “AI-powered” claim |
| **E2. Indirect or class-level evidence** | 동일 target, 동일 MoA class, 경쟁 asset, 문헌, 질환 biology 등 간접 근거 | 같은 MoA 승인약, competitor 논문, disease biology 논문 |
| **E3. Asset-specific preclinical or technical evidence** | 평가 대상 asset 자체의 전임상/기술 근거 | 해당 asset의 in vitro, in vivo, PK/PD, selectivity, delivery, tox, CMC |
| **E4. Asset-specific clinical evidence** | 평가 대상 asset 자체의 임상 근거 | 해당 asset의 Phase 1 PK/PD, human biomarker, Phase 2 efficacy |

Asset-specific evidence는 현재 평가 중인 바로 그 asset에 대해 나온 근거다. 경쟁 asset 또는 같은 MoA 승인약의 근거는 class-level/indirect evidence이며, 평가 asset의 Data Maturity를 직접 올리지 않는다.

## 2. Summary Scoring Table

| Criterion | What this criterion evaluates | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|
| Target Relevance | Target / MoA / indication이 SKBP CNS Theme 또는 Cluster에 얼마나 직접 부합하는가 | CNS 거의 무관 | general CNS relevance도 약함 | general neurodegeneration / neuroinflammation / epilepsy relevance | SKBP Theme 또는 Cluster에 정확히 해당 |
| Competitive Landscape | 같은 target / same MoA front runner가 얼마나 많고, FIC/BIC 가능성이 있는가 | 정보 부족 / 판단 불가 / front runner 5개 이상 | 경쟁 제품 2개 이상, 차별화 불명확 | front runner 1~2개, BIC 가능 | front runner 0개 또는 사실상 없음, FIC 가능 |
| MoA Validity | Target을 해당 방식으로 조절하면 disease phenotype이 개선된다는 과학적 근거가 있는가 | MoA 불명확 / 과학적 rationale 없음 | plausible rationale 또는 company claim 중심 | disease-relevant functional evidence 또는 class validation | asset-specific MoA validation 또는 human PoC |
| Platform Attractiveness | Modality/platform이 해당 target/disease에 실질적 차별성을 줄 수 있는가 | modality/platform 식별 불가 또는 rationale 없음 | rationale은 있으나 claim/논리 중심 | 기술적 차별화 rationale 명확 | asset/platform data 또는 외부 검증으로 차별성 입증 |
| Expansion Potential | 같은 target/MoA/platform으로 인접 indication 확장이 가능한가 | 확장 가능성 없음 | 이론적 확장 가능성만 있음 | 인접 indication과 biology 근거 있음 | 복수 indication/pipeline으로 확장성 확인 |
| Data Maturity | 현재 development stage에 걸맞은 asset-specific data가 구비되었는가 | stage/data 확인 불가 또는 data 없음 | stage 대비 data 부족 | stage에 부합하는 data 확인 | stage 대비 decision-ready data package |
| Marketability | credible product hypothesis와 obtainable peak sales가 성립하는가 | 상업적 rationale 또는 계산 불가 | obtainable peak sales < USD 1B | USD 1B 이상, USD 2B 미만 | USD 2B 이상 + 확장성/가격/차별성 강함 |

## 3. Detailed Criterion Rules

### 3.1 Target Relevance

Target, MoA, indication이 SKBP CNS strategic theme 또는 cluster에 얼마나 직접 부합하는지 평가한다.

- 0: CNS와 거의 무관하다.
- 1: general CNS relevance도 약하다.
- 2: general neurodegeneration / neuroinflammation / epilepsy relevance가 있다.
- 3: SKBP Theme 또는 Cluster에 정확히 해당한다. Theme와 Cluster에 모두 해당되면 반드시 3점을 부여한다.

### 3.2 Competitive Landscape

같은 target / same MoA 기준으로 front runner가 얼마나 존재하는지, FIC/BIC 가능성이 있는지 평가한다.

- 정보 부족 / 판단 불가: 0
- same-target / same-MoA front runner 0개: 3
- 1~2개: 2
- 3~4개: 1
- 5개 이상: 0

Broader same-disease competitor와 true same-target / same-MoA competitor를 반드시 구분한다.

### 3.3 MoA Validity

Target을 해당 modality/MoA로 조절했을 때 disease-relevant phenotype을 바꿀 수 있다는 과학적 근거가 있는지 평가한다.

- 0: MoA 불명확 또는 disease effect 연결 없음.
- 1: 이론적 설명, pathway association, company claim, in vitro binding/activity 수준.
- 2: class validation, peer-reviewed animal model, functional disease assay, biomarker modulation 등 credible evidence.
- 3: 해당 asset 자체의 강한 MoA validation 또는 human PoC / patient efficacy signal.

### 3.4 Platform Attractiveness

Asset의 modality/platform이 해당 target/disease에 실질적 차별성을 제공할 수 있는지 평가한다.

- 0: modality/platform 식별 불가 또는 scientific rationale 없음.
- 1: modality/platform과 rationale은 있으나 claim/논리 중심.
- 2: delivery, selectivity, BBB penetration, dosing, safety, CMC, tissue targeting 등 기술적 차별화 논리가 구체적.
- 3: asset/platform data 또는 external technical validation으로 차별성 입증.

### 3.5 Expansion Potential

같은 target/MoA/platform으로 인접 indication 확장이 가능한지 평가한다.

- 0: 확장 가능성 없음.
- 1: 이론적 가능성만 있음.
- 2: 인접 indication과 biology 근거 있음.
- 3: 복수 indication/pipeline으로 확장성 확인.

### 3.6 Data Maturity

현재 development stage에 맞는 asset-specific data가 있는지를 평가한다. Clinical stage label만으로 2점 이상을 주지 않는다.

- 0: asset-specific experimental/clinical data가 보이지 않거나 stage 검증 불가.
- 1: asset-specific information은 있으나 stage 대비 data package 부족. IND clearance, trial registration, first dosing만 있고 결과가 없으면 보통 1점.
- 2: 현재 stage에 부합하는 asset-specific data 확인.
- 3: 현재 stage 기준 decision-ready data package 확인.

Stage-specific rule:

- Discovery / Early Preclinical: in vitro 일부 = 1, disease assay 또는 early in vivo = 2, in vitro + disease assay + early in vivo + basic PK = 3.
- Preclinical / Lead Optimization: label만 있으면 0, in vitro/simple activity = 1, in vitro + in vivo + PK/PD 중 2종 이상 = 2, efficacy + PK/PD + safety/tox or candidate nomination = 3.
- IND-enabling / Phase 1-ready: claim만 있으면 0, IND/trial approval/first dosing but no result = 1, tox/PK/CMC/safety margin or partial Phase 1 result = 2, complete IND-enabling package = 3.
- Phase 1: protocol only = 1, safety/tolerability/PK result = 2, safety + PK + PD/target engagement/CNS exposure = 3.
- Phase 2: protocol only = 1, patient efficacy/biomarker/dose-response/safety 일부 = 2, clinically meaningful efficacy + biomarker/dose-response + safety = 3.
- Phase 3 / Approved: claim only = 1, pivotal result 일부 = 2, pivotal efficacy + safety + regulatory/label-level evidence = 3.

### 3.7 Marketability

Credible commercial product hypothesis와 obtainable peak sales가 성립하는지 평가한다.

Hard 0 Gate:

- Indication이 불명확하다.
- Target patient population을 정의할 수 없다.
- Therapeutic use case를 정의할 수 없다.
- Target/MoA가 너무 불명확하여 credible product hypothesis가 성립하지 않는다.
- Asset의 과학적 rationale이 부족하여 상업적 제품 가정이 불가능하다.
- TAP를 합리적으로 계산할 수 없다.
- Annual price 또는 treatment model을 합리적으로 가정할 수 없다.
- Broad disease market은 크지만, 해당 asset이 그 market에 들어갈 논리가 없다.

Commercial rationale이 성립하지 않으면 Marketability는 0점이고, TAP / Unrisked Peak Sales / Obtainable Peak Sales는 null로 표기한다.

계산 가능하면:

- TAP = Total Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate
- Unrisked Peak Sales = TAP x Annual Net Price x Peak Penetration x Treatment Duration Factor
- Obtainable Peak Sales = Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment x Expansion Capacity Adjustment

Score:

- 0: Commercial rationale cannot be established, or Obtainable Peak Sales cannot be reasonably calculated.
- 1: Obtainable Peak Sales < USD 1B.
- 2: Obtainable Peak Sales >= USD 1B and < USD 2B.
- 3: Obtainable Peak Sales >= USD 2B with credible expansion, pricing power, or differentiation.

## 4. Required Output for Each Criterion

For every criterion, output:

- score: exact integer 0, 1, 2, or 3
- evidence_type: one of E0/E1/E2/E3/E4 allowed values
- evidence_type_reason
- main_line_summary
- what_was_checked
- evidence_trail
- evidence_sources
- investigation_note
- why_not_higher
- uncertain_points

Do not output score ranges. Do not infer one criterion score from another. Do not use company claims as data unless clearly labeled as claim.
