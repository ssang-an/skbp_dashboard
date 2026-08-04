# SKBP Pipeline Finder v3.3 — Full Scoring Criteria

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

TR에는 조사 과정에서 확인된 가장 구체적인 indication wording을 사용한다. Neuropathic pain 또는 명확한 subtype/synonym은 interest indication이다. `Pain`만 확인되고 subtype이 불명확하거나 acute/postoperative/non-neuropathic pain이면 TR 1 기준을 적용한다.

## 4. Summary Scoring Table

| Criterion | What this criterion evaluates | 0점 | 1점 | 2점 | 3점 |
|---|---|---|---|---|---|
| **Target Relevance** | SKBP 우선 관심 적응증 및 R&D Theme/Cluster와의 적합성을 평가합니다. | SKBP 관련성을 판단할 정보가 부족하거나 관심 질환 범위 밖 | 신경계·신경면역·신경퇴행·통증 관련 질환이지만 SKBP 우선 관심 적응증에는 해당하지 않음 | SKBP 우선 관심 적응증에 해당 | SKBP 우선 관심 적응증에 해당하며, target/MoA가 해당 질환 biology 또는 SKBP Theme/Cluster에 직접 연결 |
| **Competitive Landscape** | 같은 target/same MoA front runner가 얼마나 많고 FIC/BIC 가능성이 있는가 | 정보 부족/판단 불가 또는 front runner 5개 이상 | front runner 3~4개 또는 차별화 약함 | front runner 1~2개, BIC 가능 | front runner 0개 또는 사실상 없음, FIC 가능 |
| **MoA Validity** | 작용기전이 얼마나 구체적으로 정의되어 있고 이를 뒷받침하는 기능적·과학적 근거가 어느 수준인지 평가합니다. | Target 또는 작용기전을 확인할 수 없어 평가 불가 | 작용기전 설명은 있으나 회사 주장 또는 이론적 근거 중심 | 기전이 실제로 작동함을 보여주는 기능적 실험 또는 동일 target/class의 독립 검증 근거 있음 | 해당 asset에서 target engagement, mechanism-linked PD/biomarker 또는 직접적인 작용기전 검증이 확인됨 |
| **Platform Attractiveness** | 다른 프로그램에도 반복 적용 가능한 platform-level 기술적 우위가 있는가 | Platform 실재 또는 구현 가능성 불명확 | 차별성 claim·이론적 rationale 중심 | Comparator 대비 정량적 기술 우위가 확인되나 단일·전임상 조건에 제한 | Platform 적용 자산 First Patient Dosed 또는 반복성·외부검증 확인 |
| **Expansion Potential** | 같은 target/MoA/platform으로 인접 indication 확장이 가능한가 | 확장 가능성 없음 | 이론적 확장 가능성만 있음 | 인접 indication과 biology 근거 있음 | 복수 indication/pipeline으로 확장성 확인 |
| **Data Maturity** | 해당 asset의 개발 단계에 맞는 공개 데이터가 얼마나 충분하고 해석 가능한지 평가합니다. | 공개된 asset-specific 결과 없음 | 정성적 claim 또는 단편적 결과만 있어 개발 단계 대비 불충분 | 개발 단계에 맞는 해석 가능한 정량적 evidence domain이 1개 이상 공개 | 개발 단계에 맞는 상호보완적 정량적 evidence domain이 2개 이상 공개 |
| **Marketability** | credible product hypothesis와 obtainable peak sales가 성립하는가 | 상업적 rationale 또는 계산 불가 | obtainable peak sales < USD 1B | USD 1B 이상, USD 2B 미만 | USD 2B 이상 + 확장성/가격/차별성 강함 |

## 5. Detailed Criterion Rules

### 5.1 Target Relevance

항상 높은 점수부터 판정하며 여러 조건에 해당하면 가장 높은 적용 가능 점수 하나만 부여한다.

- **3점:** 확인된 상세 indication이 interest indication이고 target 또는 MoA가 해당 질환 biology나 SKBP R&D Theme/Cluster에 직접 연결된다.
- **2점:** 확인된 상세 indication이 interest indication이지만 direct biology fit이 확인되지 않았거나 근거가 불충분하다. Target/MoA가 undisclosed여도 상세 indication이 확인되면 가능하다.
- **1점:** interest indication 밖이지만 신경계·신경면역·신경퇴행·통증 관련 질환이거나, claimed interest indication과 공개 target/MoA가 명백히 무관하거나 과학적으로 모순된다.
- **0점:** indication·target·MoA가 부족해 relevance를 판단할 수 없거나 확인된 indication이 SKBP 관련 질환 범위 밖이다.

근거가 약하거나 불충분하면 TR 2를 유지하고 TR 3만 부여하지 않는다. 공개 target/MoA가 명백히 무관하거나 과학적으로 모순될 때만 TR 1로 낮춘다. Undisclosed target/MoA는 contradiction이 아니다. Source trail, investigation note, why_not_higher 및 uncertain points를 상세히 기록한다.

### 5.2 Competitive Landscape

Broader same-disease competitor와 true same-target/same-MoA competitor를 구분한다.

- 정보 부족/판단 불가 또는 front runner 5개 이상: 0점
- front runner 3~4개: 1점
- front runner 1~2개: 2점
- front runner 0개 또는 사실상 없음: 3점

### 5.3 MoA Validity

- **Functional evidence:** target/pathway 조절 뒤 예상되는 functional 또는 downstream biological effect가 실험에서 확인된 근거.
- **Same target/class validation:** 평가 asset이 아닌 다른 약물, 독립 연구 또는 동일 class에서 target/mechanism이 검증된 근거.
- **Asset-specific validation:** 평가 asset 자체에서 target engagement, mechanism-linked PD/biomarker 또는 직접 functional effect가 확인된 근거.

일반적인 clinical efficacy만으로 MoA 3점을 주지 않는다. Clinical evidence를 쓰려면 proposed mechanism과 연결된 mechanism-linked clinical PoC여야 한다.

### 5.4 Platform Attractiveness

개별 asset의 성숙도가 아니라 modality, delivery, chemistry, manufacturing 등 underlying technology/platform의 반복 적용 가능한 기술적 우위를 평가한다.

- 0점: Platform 실재성·구현 가능성·성능을 평가할 공개 근거가 없음.
- 1점: 회사 claim, 이론적 rationale, 특허 또는 diagram만 있고 comparator 대비 정량 기술 데이터 없음.
- 2점: 적절한 comparator 대비 delivery, potency, selectivity, durability, safety 또는 manufacturability의 정량 우위가 확인되나 단일 asset/payload/model/species 또는 회사 자체 전임상 조건에 제한됨.
- 3점: Platform 적용 자산이 실제 First Patient Dosed를 달성했거나, 임상 전 정량 우위가 복수 조건에서 재현되고 독립 검증/외부 사용이 확인됨.

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

### 5.5 Expansion Potential

- 0점: 확장 가능성 없음.
- 1점: 이론적 가능성만 있음.
- 2점: 인접 indication과 biology 근거 있음.
- 3점: 복수 indication/pipeline으로 확장성 확인.

### 5.6 Data Maturity

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

Commercial rationale이 성립하지 않으면 Marketability는 0점이고 TAP/Unrisked Peak Sales/Obtainable Peak Sales는 `null`이다. 계산 가능할 때:

- TAP = Total Patient Pool × Diagnosis Rate × Eligibility Rate × Treatable Subgroup Rate
- Unrisked Peak Sales = TAP × Annual Net Price × Peak Penetration × Treatment Duration Factor
- Obtainable Peak Sales = Unrisked Peak Sales × Competition Haircut × Pricing Power Adjustment × Expansion Capacity Adjustment

Score:

- 0점: Commercial rationale 또는 Obtainable Peak Sales를 합리적으로 수립할 수 없음.
- 1점: Obtainable Peak Sales < USD 1B.
- 2점: Obtainable Peak Sales >= USD 1B and < USD 2B.
- 3점: Obtainable Peak Sales >= USD 2B이며 credible expansion, pricing power 또는 differentiation이 있음.

Controlled vocabulary:

`commercial_rationale_status`는 아래 값 중 정확히 하나만 사용한다.

- `established`
- `not_established`
- `evidence_based`
- `assumption_based`
- `assumption_based_scenario`
- `insufficient_evidence`

`provisional`, `uncertain`, `partial`, `pending` 같은 값을 쓰지 않는다. 불확실성은 `commercial_rationale_failure_reason`, `investigation_note`, `uncertain_points`에 기록한다. Status가 `not_established` 또는 `insufficient_evidence`면 A/B/C calculated field는 `null`로 두고 이유를 명시한다.

## 6. Canonical Development Stage

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

확인된 명시적 stage 또는 완료·착수 milestone만 canonicalize한다. 계획·예상·목표, 투자 유치, 채용공고로 현재 stage를 추론하지 않는다. `preclinical`만 있으면 `Preclinical unspecified`, candidate nominated/selected면 `Preclinical Candidate`, 실제 GLP tox/IND-directed CMC/IND-enabling study 진행은 `IND-enabling`, IND/CTA submitted/filed/accepted/effective/cleared는 `IND filed/cleared`다. 임상 synonym은 확인된 표현을 canonical bucket으로 mapping하고 trial status는 source evidence/notes에 보존한다. 상충을 해소할 수 없으면 `Unknown`과 uncertainty를 기록한다.

## 7. Full Scout Hard Filter

기존 v3.2 threshold를 유지한다.

- **PASS:** total score 14점 이상, TR 3점 이상, MoA 2점 이상, Data 2점 이상, 명확한 hard blocker 없음.
- **REVIEW:** 기존 중간 점수/불확실성 threshold를 유지한다.
- **FAIL:** 기존 total/TR/hard-blocker threshold를 유지한다.

SKBP Theme/Cluster direct fit이 없다는 이유만으로 자동 FAIL 처리하지 않는다. `no SKBP Theme / Cluster fit`은 FAIL condition이 아니다.

## 8. Required Output for Each Criterion

각 criterion에는 `score`, `evidence_type`, `evidence_type_reason`, `main_line_summary`, `what_was_checked`, `evidence_trail`, `evidence_sources`, `investigation_note`, `why_not_higher`, `uncertain_points`를 기록한다. 범위형 score를 쓰지 않고, 회사 claim은 명확히 claim으로 표시한다.
