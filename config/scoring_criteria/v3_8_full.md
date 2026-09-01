# SKBP Pipeline Finder v3.8 — Full Scoring Criteria

This release is a complete, self-contained decision reference. It retains the v3.7 Evidence Discipline, Evidence Type, canonical taxonomy, and Marketability `Global Obtainable Peak Sales` calculation with its `1.5` US-to-global multiplier, while applying the active score rules: the Full Scout PASS Target Relevance gate is `TR >= 3`; Competitive Landscape is determined by comparator-backed evidence rather than competitor count; Platform Attractiveness Score 3 requires reproducibility or official First Patient Dosed after the Score-2 evidence; and Expansion Potential Score 3 requires an official additional-indication program plus asset-specific quantitative data in that same indication, without a separate multiple-indication gate. Identity/lifecycle remains a pre-research gate and Section 8 retains the early-stop display rule. Theme/Cluster remains classification and exploration metadata only; it is not a Target Relevance score basis.

## Canonical Score-Rule Alignment

The following inherited rules are restated here as the active v3.8 decision reference:

- **Target Relevance:** 0 is only for an identity-verified asset with insufficient indication/relevance information; 1 is outside the broad SKBP neurologic/psychiatric/neuroimmune/neurodegenerative/pain scope; 2 is within that broad scope but outside the six priority indications; 3 is one of the six priority indications. Generic, acute, postoperative, and non-neuropathic pain are TR 2; neuropathic pain is TR 3. Identity not verified is an early stop, not TR 0.
- **Platform Attractiveness:** Score 2 requires at least one quantitative technical advantage versus an appropriate comparator, normally limited to a single condition or platform-derived asset. Score 3 first requires that Score-2 evidence, then either (a) reproduction of the same advantage across multiple independent conditions (for example, model, species, or dose) or officially linked platform-derived assets, or (b) First Patient Dosed by an officially linked platform-derived asset. First Patient Dosed alone is insufficient.
- **Expansion Potential:** 2 requires assessed-asset early quantitative data in at least one additional indication. 3 requires an official preclinical, IND-enabling, or clinical assessed-asset program and asset-specific quantitative efficacy, PD, or biomarker data in the same additional indication; multiple additional indications are not required.
- **Data Maturity 3:** requires at least two complementary, stage-appropriate quantitative evidence domains, with at least one directly supporting program progression.
- **Competitive Landscape:** distinguish direct competitors from broader reference competitors for the search record, but do not score by competitor count. Score 2 requires asset-specific quantitative differentiation versus an appropriate benchmark comparator or a substantiated entry space. Score 3 requires Score-2 evidence plus direct head-to-head quantitative evidence of material advantage versus an appropriate comparator in matched or comparable preclinical or clinical conditions.
- **Marketability:** assessed Global peak sales alone determines the 1/2/3 threshold; Expansion Capacity Adjustment is excluded from the calculation.

## 0. Scoring Operating Principle

각 scoring criterion은 서로 독립적으로 평가한다.

- 모든 score는 반드시 `0`, `1`, `2`, `3` 중 하나의 단일 정수다.
- 범위형 점수는 사용하지 않는다.
- 불확실성은 `investigation_note`, `why_not_higher`, `uncertain_points`에 기록한다.
- Evidence Type은 score를 자동 결정하는 rule이 아니라 score의 근거 수준을 보여주는 audit label이다.

## 1. Evidence Discipline

Use only asset-specific facts explicitly provided by the user or verified from credible public sources.

Canonicalize confirmed facts into approved dashboard values, but do not infer unconfirmed facts or completed/current status from plans, expectations, financing, hiring activity, adjacent programs, class assumptions, or general scientific knowledge.

General scientific knowledge may only be used to map confirmed facts to the scoring rubric. If a fact cannot be established or conflicting sources cannot be resolved, use Unknown and record the uncertainty.

이 원칙은 모든 factual field와 scoring criterion에 적용한다. 일반 과학지식으로 새로운 asset-specific target, MoA, indication, stage, ownership, status 또는 data를 생성하지 않는다.

## 2. Evidence Type

| Evidence Type | Definition | Examples |
|---|---|---|
| **E0. Not found / Not assessable** | 신뢰 가능한 근거가 없거나 판단 불가 | target 미공개, MoA 미공개, 경쟁 정보 확인 불가 |
| **E1. Company claim or scientific rationale only** | 회사 주장·과학적 논리는 있으나 실험값/임상값 미공개 | “BBB penetrant”, “highly selective” claim |
| **E2. Indirect or class-level evidence** | 동일 target/MoA class, 경쟁 asset, 문헌, 질환 biology 등 간접 근거 | 동일 MoA 승인약, 독립 연구 |
| **E3. Asset-specific preclinical or technical evidence** | 평가 asset 자체의 전임상·기술 근거 | in vitro, in vivo, PK/PD, selectivity, tox, CMC |
| **E4. Asset-specific clinical evidence** | 평가 asset 자체의 임상 근거 | human PK/PD, biomarker, efficacy |

## 3. SKBP Interest Indications

- Alzheimer's disease
- Parkinson's disease
- Amyotrophic lateral sclerosis / motor neuron disease
- Multiple sclerosis / neuroinflammatory disease
- Neuropathic pain
- Epilepsy / seizure disorders

TR에는 조사 과정에서 확인된 가장 구체적인 indication wording을 사용한다. Neuropathic pain 및 명확한 subtype/synonym은 6개 interest indication으로 TR 3점에 해당한다. `Pain`만 확인되거나 acute/postoperative/non-neuropathic pain이면 넓은 SKBP pain 범위 내의 비우선 indication으로 TR 2점에 해당한다. TR은 indication의 전략 범위만 평가하며, target/MoA의 질환 biology 연결성은 MoA Validity에서 평가한다.

## 3.1 R&D Theme Taxonomy

- `E/I Balance`
- `Neuroimmune`
- `Protein Homeostasis`

Theme은 조사로 확인한 assessed asset의 target/MoA가 직접 연결될 때만 매핑한다. `Protein Homeostasis`는 protein folding/chaperone, ubiquitin-proteasome, autophagy-lysosome, ER stress/UPR 또는 pathogenic aggregate clearance를 직접 조절하는 경우에 한한다. 질환에 단백질 응집이 존재한다는 사실만으로는 해당 Theme을 부여하지 않는다. Protein Homeostasis의 하위 Cluster taxonomy는 아직 승인되지 않았으므로 Cluster는 `Unknown`을 사용한다.

## 4. Summary Scoring Table

| Criterion | What this criterion evaluates | 0점 | 1점 | 2점 | 3점 |
|---|---|---|---|---|---|
| **Target Relevance** | 확인된 asset의 indication이 SKBP 전략 범위와 얼마나 맞는지 평가합니다. Theme/Cluster와 disease biology 연결성은 별도 분류 및 MoA 평가에 사용합니다. | Identity 확인 후에도 indication/relevance 판단 정보 부족 (identity 미확인은 조기 종료) | SKBP의 넓은 신경계·정신과·신경면역·신경퇴행·통증 범위 밖 | 넓은 SKBP 범위에는 속하지만 6개 우선 적응증 밖 | 6개 SKBP 우선 적응증 중 하나에 해당 |
| **MoA Validity** | 작용기전이 얼마나 구체적으로 정의되어 있고 이를 뒷받침하는 기능적·과학적 근거가 어느 수준인지 평가합니다. | Target 또는 작용기전을 확인할 수 없어 평가 불가 | 작용기전 설명은 있으나 회사 주장 또는 이론적 근거 중심 | 기전이 실제로 작동함을 보여주는 기능적 실험 또는 동일 target/class의 독립 검증 근거 있음 | 해당 asset에서 target engagement, mechanism-linked PD/biomarker 또는 직접적인 작용기전 검증이 확인됨 |
| **Data Maturity** | 해당 asset의 개발 단계에 맞는 공개 데이터가 얼마나 충분하고 해석 가능한지 평가합니다. | 공개된 asset-specific 결과 없음 | 정성적 claim 또는 단편적 결과만 있어 개발 단계 대비 불충분 | 개발 단계에 맞는 해석 가능한 정량적 evidence domain이 1개 이상 공개 | 상호보완적·stage-appropriate 정량 evidence domain이 2개 이상이고, 그중 최소 1개가 program progression을 직접 지지 |
| **Competitive Landscape** | comparator 대비 확인된 차별성과 현실적 진입 가능성 | 검색 또는 근거 부족으로 comparator와 경쟁구도 판단 불가 | 경쟁자는 확인되나 차별성은 claim 또는 이론 수준 | 적절한 benchmark comparator 대비 asset-specific 정량 차별성, 또는 asset-specific 근거로 확인된 현실적 진입공간 | 2점 조건 + 적절한 comparator와 동일하거나 비교 가능한 조건의 직접 head-to-head 정량 비교로 material advantage 확인 |
| **Platform Attractiveness** | 다른 프로그램에도 반복 적용 가능한 platform-level 기술적 우위가 있는가 | Platform 실재 또는 구현 가능성 불명확 | 차별성 claim·이론적 rationale 중심 | 적절한 comparator 대비 정량 기술 우위 1건 확인 (단일 조건 또는 단일 platform 적용 asset 수준) | 2점 근거 + (같은 우위가 복수 독립 조건 또는 복수 공식 연결 platform 적용 asset에서 재현됨, 또는 공식 연결 platform 적용 asset First Patient Dosed) |
| **Expansion Potential** | assessed asset의 main indication 외 추가 indication 확장이 확인되는가 | 추가 indication 미확인 | 추가 indication과 biology rationale만 확인 | 하나 이상의 추가 indication에서 assessed asset의 초기 정량 efficacy·PD·biomarker 데이터 확인 | 하나 이상의 추가 indication에서 assessed asset의 초기 정량 efficacy·PD·biomarker 데이터와 공식 전임상·IND-enabling·임상 개발 program이 함께 확인 |
| **Marketability** | credible product hypothesis와 obtainable peak sales가 성립하는가 | 상업적 rationale 또는 계산 불가 | assessed Global peak sales < USD 1B | assessed Global peak sales >= USD 1B and < USD 2B | assessed Global peak sales >= USD 2B |

## 5. Detailed Criterion Rules

### 5.1 Target Relevance

항상 높은 점수부터 판정하며 여러 조건에 해당하면 가장 높은 적용 가능 점수 하나만 부여한다.

- **3점:** 확인된 상세 indication이 6개 SKBP 우선 적응증 중 하나다.
- **2점:** 확인된 상세 indication은 넓은 SKBP 신경계·정신과·신경면역·신경퇴행·통증 범위에 속하지만 6개 우선 적응증에는 해당하지 않는다.
- **1점:** asset identity와 indication은 확인됐지만 넓은 SKBP 범위 밖이다.
- **0점:** identity가 확인된 뒤에도 indication/relevance를 평가할 수 있는 최소 정보가 없을 때만 부여한다.

Asset identity 자체를 확인할 수 없으면 TR 0점 평가 대신 조기 종료를 사용한다. Target/MoA의 질환 biology 연결성은 TR 점수에 반영하지 않는다. Source trail, investigation note, why_not_higher 및 uncertain points를 상세히 기록한다.

### 5.2 MoA Validity

- **Functional evidence:** target/pathway 조절 뒤 예상되는 functional 또는 downstream biological effect가 실험에서 확인된 근거.
- **Same target/class validation:** 평가 asset이 아닌 다른 약물, 독립 연구 또는 동일 class에서 target/mechanism이 검증된 근거.
- **Asset-specific validation:** 평가 asset 자체에서 target engagement, mechanism-linked PD/biomarker 또는 직접 functional effect가 확인된 근거.

일반적인 clinical efficacy만으로 MoA 3점을 주지 않는다. Clinical evidence를 쓰려면 proposed mechanism과 연결된 mechanism-linked clinical PoC여야 한다.

#### Investigation note 기록 규칙

MoA 2점 또는 3점이면 `investigation_note`에, 이미 점수 산정에 사용한 확인 근거가 disease-relevant phenotype·efficacy·biomarker와 연결되는지 또는 세포신호 marker 등 proximal 지표에 그치는지를 한 문장 이내로 기록한다. MoA 0점 또는 1점에는 이 구분을 작성하지 않는다. 판단할 근거가 불충분하면 `확인 불가`로 기록하며, 추측하거나 이 기록을 위해 새 검색을 요구하지 않는다.

### 5.3 Data Maturity

Evidence domain은 서로 다른 개발 질문에 답하는 데이터 범주다. 예: in vitro activity/selectivity, target engagement/PD, in vivo efficacy, PK/PD, safety/tolerability, clinical outcome.

- 동일 underlying experiment의 endpoint, dose, figure 또는 반복 source는 한 domain이다.
- 하나의 공개 source에 서로 다른 개발 질문에 답하는 in vivo efficacy와 PK/PD 같은 결과가 함께 있으면 서로 다른 두 domain으로 평가할 수 있다. Source 개수 자체로 점수를 제한하지 않는다.
- Potency와 selectivity는 하나의 in vitro characterization domain이다.
- Data 3은 complementary, stage-appropriate domain이 최소 2개이고 그중 하나가 program progression을 직접 뒷받침해야 한다.
- Human data는 필수조건이 아니다.
- 다른 asset 또는 platform-wide data는 assessed asset의 Data Maturity를 올리지 않는다.

Source trail, missing data, stage-data alignment, why_not_higher 및 uncertain points를 상세히 기록한다.

#### Platform Attractiveness와의 구분

| 데이터 또는 질문 | Platform Attractiveness | Data Maturity |
|---|---|---|
| 다른 asset에서 동일 platform 성능 확인 | 반영 가능 | 반영 불가 |
| 복수 payload에서 delivery 우위 재현 | 핵심 근거 | 직접 반영하지 않음 |
| assessed asset의 in vitro/in vivo efficacy | platform 기여를 comparator로 분리한 경우만 | 핵심 근거 |
| assessed asset의 dose-response, PK/PD | platform claim을 직접 검증할 때만 보조 반영 | 핵심 근거 |
| 다른 asset의 First Patient Dosed | 3점 가능 | 반영 불가 |
| assessed asset의 First Patient Dosed | 3점 가능 | 공개된 stage-appropriate domain으로 평가 |
| 다른 asset의 human data | human platform validation으로 반영 가능 | 반영 불가 |
| assessed asset의 human target engagement 또는 PoC | platform claim 관련 endpoint만 반영 | 핵심 근거 |
| 공통 제조공정의 수율·batch consistency | Platform 근거 | 직접 반영하지 않음 |
| assessed asset의 GLP tox·clinical batch·release assay | 공통 platform 특성이 아니면 제한적 | 핵심 근거 |
| MOU·투자·특허·IND clearance | 단독 가점 불가 | asset data로 가점 불가 |

동일 source를 두 criterion에 인용할 수 있지만 동일 endpoint를 양쪽에 중복 가점하지 않는다.

### 5.4 Competitive Landscape

Broader/reference competitor와 direct competitor를 구분해 검색 기록에 남긴다. Direct competitor는 **주 적응증과 주 치료 접근이 실질적으로 같은 경우**, 즉 target/pathway intervention과 therapeutic effector mechanism이 모두 실질적으로 겹칠 때만 적용한다. 질환명, 병리 단백질·biomarker, endpoint 또는 modality 하나만 같은 경우는 broader/reference competitor이며 direct competitor로 자동 분류하지 않는다. 이 분류와 경쟁자 수는 점수를 자동 결정하지 않는다.

- **0점:** 검색 범위 또는 근거가 부족하여 적절한 comparator와 경쟁구도를 판단할 수 없다. 경쟁자를 찾지 못한 사실만으로는 판단 불가를 해소하지 않는다.
- **1점:** 경쟁자는 확인되나, assessed asset의 차별성은 회사 claim, 기전 가설 또는 비정량적 설명 수준이다.
- **2점:** 적절한 benchmark comparator 대비 assessed asset의 asset-specific 정량 차별성(예: efficacy, safety, PK/PD, delivery 또는 therapeutic window)이 확인되거나, 기존 치료의 뚜렷한 미충족 수요를 assessed asset의 target/MoA·route·safety 또는 접근성 근거로 해결할 현실적 진입공간이 확인된다. 단순히 질환에 unmet need가 크다는 사실, 시장 규모 또는 회사의 포지셔닝 claim만으로는 충분하지 않다.
- **3점:** 2점 조건을 충족하면서, 적절한 comparator와 동일하거나 비교 가능한 조건에서 수행한 assessed asset의 직접 head-to-head 정량 비교로 material advantage가 확인된다. Material advantage는 해당 comparator 대비 의사결정에 의미 있는 크기의 정량 우위이며, 사소한 수치 차이만으로는 충족하지 않는다. 전임상과 임상 모두 적용할 수 있으나, 단순 cross-study 비교, claim, 경쟁자 부재 또는 경쟁자 수만으로는 3점을 부여하지 않는다.

### 5.5 Platform Attractiveness

개별 asset의 성숙도가 아니라 modality, delivery, chemistry, manufacturing 등 underlying technology/platform의 반복 적용 가능한 기술적 우위를 평가한다.

- 0점: Platform 실재성·구현 가능성·성능을 평가할 공개 근거가 없음.
- 1점: 회사 claim, 이론적 rationale, 특허 또는 diagram만 있고 comparator 대비 정량 기술 데이터 없음.
- 2점: 적절한 comparator 대비 delivery, potency, selectivity, durability, safety 또는 manufacturability의 정량 우위가 최소 1건 확인되나, 단일 asset/payload/model/species 또는 회사 자체 전임상 조건에 제한됨.
- 3점: 반드시 2점의 정량 comparator 근거를 먼저 충족한 뒤, 다음 둘 중 하나가 확인됨. (a) 같은 정량 우위가 복수의 독립 조건(예: 모델·종·용량) 또는 복수의 공식 연결 platform-derived asset에서 재현됨. (b) 공식 연결 platform-derived asset이 실제 First Patient Dosed를 달성함. First Patient Dosed만으로는 3점을 부여하지 않음.

#### Platform 2점 기술 데이터의 최소 정의

다음 내용을 모두 확인할 수 있어야 한다.

1. 평가 asset 또는 payload와 platform의 연결
2. 정량적 endpoint
3. 적절한 comparator
4. model, species, dose, route, time point 등 실험 맥락
5. delivery, potency, selectivity, durability, safety, manufacturability 중 검증한 기술적 장점

인정 가능한 예:

- AAV9 대비 brain expression 8배 증가
- Parent siRNA 대비 target knockdown 25%에서 70%로 개선
- Comparator 대비 liver exposure 80% 감소
- 기존 공정 대비 생산수율 3배 증가
- 동일 효능에서 투여량 5분의 1 감소

정성적 회사 주장, 특허, MOU·공동연구 발표, 투자유치, IND 제출·clearance, trial registration, pipeline asset 수 또는 임상단계라는 사실만으로는 기술 데이터로 인정하지 않는다.

#### First Patient Dosed 운영 규칙

- 임상 진입 자산이 평가 대상 platform을 사용한다는 공식 근거가 있어야 한다.
- First Patient Dosed는 회사 보도자료, trial update 또는 임상등록 업데이트 등 신뢰 가능한 출처에서 확인되어야 한다.
- 같은 platform의 다른 asset이 First Patient Dosed를 달성해도 Platform Attractiveness에는 3점을 줄 수 있으나 assessed asset의 Data Maturity에는 반영하지 않는다.
- IND clearance, trial registration, recruitment planned 또는 trial initiation announced만으로는 3점을 주지 않는다.
- First Patient Dosed는 human implementation 확인 기준이며 임상 효능 입증을 의미하지 않는다.
- First Patient Dosed만으로는 3점을 주지 않으며, 반드시 2점의 정량 comparator 근거가 함께 있어야 한다.

### 5.6 Expansion Potential

Main indication의 다른 표현, patient subgroup, platform-wide indication list 또는 미래 계획은 expansion으로 계산하지 않는다.

- 0점: assessed asset의 main indication 외 추가 indication이 확인되지 않음.
- 1점: 추가 indication과 biology rationale만 확인되고 asset-specific 데이터나 공식 개발 program은 없음.
- 2점: 하나 이상의 추가 indication에서 assessed asset의 초기 정량 efficacy, PD 또는 biomarker 데이터가 확인됨.
- 3점: 하나 이상의 추가 indication에서 assessed asset의 초기 정량 efficacy, PD 또는 biomarker 데이터와 assessed asset의 공식 전임상·IND-enabling·임상 개발 program이 함께 확인됨. 복수 추가 indication은 요구하지 않는다.

#### Investigation note 기록 규칙

Expansion Potential 1점 이상이면 `investigation_note`에 확인된 추가 indication이 단일인지 복수인지, 그리고 각 additional indication의 assessed-asset program 및 data 상태를 간단히 기록한다. 이 기록에는 이미 점수 산정에 사용한 근거만 사용한다. 판단할 근거가 불충분하면 `확인 불가`로 기록하며, 추측하거나 이 기록을 위해 새 검색을 요구하지 않는다.

### 5.7 Marketability

Credible commercial product hypothesis와 obtainable peak sales가 성립하는지 평가한다.

Hard 0 Gate:

- Indication이 불명확하다.
- Target patient population을 정의할 수 없다.
- Therapeutic use case를 정의할 수 없다.
- Target/MoA가 너무 불명확하여 credible product hypothesis가 성립하지 않는다.
- Asset의 과학적 rationale이 부족하여 상업적 제품 가정이 불가능하다.
- TAP를 합리적으로 계산할 수 없다.
- Annual price 또는 treatment model을 합리적으로 가정할 수 없다.
- Broad disease market은 크지만 해당 asset이 그 market에 들어갈 논리가 없다.

Commercial rationale이 성립하지 않으면 Marketability는 0점이고 A/B/C/D 결과는 `null`이다. 계산 가능할 때:

- A. US TAP = US Patient Pool × Diagnosis Rate × Eligibility Rate × Treatable Subgroup Rate
- B. US Unrisked Peak Sales = US TAP × Benchmark Annualized Net Price × Peak Penetration × Treatment Duration Factor
- C. US Obtainable Peak Sales = US Unrisked Peak Sales × Competition Haircut × Pricing Power Adjustment
- D. Global Obtainable Peak Sales = C. US Obtainable Peak Sales × 1.5

`×1.5`는 미국 기준 C 또는 미국 기준 외부 peak-sales forecast에 정확히 한 번만 적용한다. 이미 Global인 forecast에는 다시 적용하지 않는다. Expansion Capacity Adjustment는 산식에서 제외하며, 구버전 호환 필드가 있으면 1.0으로 고정하고 점수에 사용하지 않는다.

Score:

- 0점: Commercial rationale 또는 신뢰 가능한 Global peak sales를 합리적으로 수립할 수 없음.
- 1점: Assessed Global Peak Sales < USD 1B.
- 2점: Assessed Global Peak Sales >= USD 1B and < USD 2B.
- 3점: Assessed Global Peak Sales >= USD 2B.

Controlled vocabulary:

`commercial_rationale_status`는 아래 값 중 정확히 하나만 사용한다.

- `established`
- `not_established`
- `evidence_based`
- `assumption_based`
- `assumption_based_scenario`
- `insufficient_evidence`

`provisional`, `uncertain`, `partial`, `pending` 같은 값을 쓰지 않는다. 불확실성은 `commercial_rationale_failure_reason`, `investigation_note`, `uncertain_points`에 기록한다. Status가 `not_established` 또는 `insufficient_evidence`면 A/B/C/D calculated field는 `null`로 두고 이유를 명시한다.

## 6. Canonical Development Stage

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

확인된 명시적 stage 또는 완료·착수 milestone만 canonicalize한다. 계획·예상·목표, 투자 유치, 채용공고로 현재 stage를 추론하지 않는다. `Hit ID`/`hit identification`, 명시적인 `research program`/`research project`/`discovery program`/`discovery project`는 `Hit Discovery`, `FIH`/`Ph1`/`Ph1a`/`Ph1b`는 `Phase 1`, 확인된 `Ph1b/2a`는 `Phase 1/2`, `FDA approved`는 `Approved / marketed`, `pre-PCC`는 `Lead Optimization`이다. `Phase 2 planned` 또는 `Phase 2/3 planned`는 해당 phase를 확정하지 않으므로 명시적으로 확인된 이전 current phase가 없으면 `Unknown`이다. `preclinical`만 있으면 `Preclinical unspecified`, candidate nominated/selected면 `Preclinical Candidate`, 실제 GLP tox/IND-directed CMC/IND-enabling study 진행은 `IND-enabling`, IND/CTA submitted/filed/accepted/effective/cleared는 `IND filed/cleared`다. 시작·진행 중인 clinical/pivotal/registrational trial에서 phase가 없으면 `Clinical unspecified`이며, pivotal/registrational만으로 `Phase 3`를 추론하지 않는다. 명시적으로 확인된 `discontinued`, `terminated`, `withdrawn`, `inactive`, `dormant`, `abandoned`만 `Discontinued / inactive`다. `suspended`/`halted`는 pause signal이므로 영구 비활성이 확인되기 전까지 FAIL로 처리하지 않고 REVIEW와 pause note를 남긴다. 임상 synonym은 확인된 표현을 canonical bucket으로 mapping하고 trial status는 source evidence/notes에 보존한다. 상충을 해소할 수 없으면 `Unknown`과 uncertainty를 기록한다.

## 7. Full Scout Hard Filter

Identity and lifecycle checks occur before extended research. `structured_table.development_stage` is the sole lifecycle signal: a confirmed terminal lifecycle must be canonicalized to `Discontinued / inactive`; no separate active/inactive field or lifecycle keyword in notes/flags is a status gate.

- If asset identity cannot be verified as a specific biotech/pharma pipeline, stop early and record the required identity result. Do not complete the seven-criterion assessment.
- If credible evidence confirms a terminal lifecycle (`discontinued`, `terminated`, `withdrawn`, `inactive`, `dormant`, `abandoned`, or clearly failed), set `development_stage` to `Discontinued / inactive`, stop early, and record the lifecycle FAIL result. Do not complete extended diligence.
- `suspended` or `halted` alone is a pause signal, not terminal lifecycle evidence: retain a confirmed stage where available, otherwise use `Unknown`, and continue the completed assessment.

For an identity-verified, non-terminal asset that completes Full Scout, derive the status as follows:

| Status | Rule |
|---|---|
| **PASS** | Total score >= 14, Target Relevance >= 3, MoA Validity = 3, and Data Maturity = 3 |
| **FAIL** | Total score <= 8, or Target Relevance = 0, or MoA Validity = 0, or Data Maturity = 0 |
| **REVIEW** | Any completed assessment that meets neither PASS nor FAIL |

`decision_uncertainty` is recorded in the relevant criterion notes and may explain a REVIEW outcome, but it does not independently veto a completed score-based PASS. A confirmed non-lifecycle hard blocker remains a server-side safety FAIL condition; lifecycle is determined only by `development_stage`.

SKBP Theme/Cluster는 분류·탐색 정보이며 TR 점수 또는 PASS/FAIL의 직접 조건이 아니다. `no SKBP Theme / Cluster fit`은 FAIL condition이 아니다.

## 8. Required Output for Each Criterion

각 criterion의 Markdown section에는 score, evidence type, 핵심 판단, 확인 항목, evidence trail/source, investigation note, why-not-higher, uncertainty를 모두 기록한다. Compact v2 JSON criterion에는 대시보드 표시용 정수 `score`, 짧은 판단/근거/불확실성 필드, 그리고 중앙 `source_registry`를 가리키는 `source_ids`만 저장하며, Markdown의 전체 조사 내용을 중복하지 않는다. `structured_table.sources`는 `[]`로 유지하고 대시보드 Source 열은 `validation.source_registry`에서 파생한다. 범위형 score를 쓰지 않고, 회사 claim은 명확히 claim으로 표시한다.

MoA 및 Expansion Potential의 위 `investigation_note` 기록은 이미 score 산정에 사용한 근거를 짧게 요약하는 절차이며, 추가 검색이나 점수 규칙 변경을 요구하지 않는다.

Retain the v3.5 Compact v2 JSON structure and all criterion-level source, uncertainty, and why-not-higher requirements. For early-stop identity/lifecycle results, preserve the required JSON contract while displaying the three core score cells as `—`; do not portray schema placeholder zeroes as completed assessments.
