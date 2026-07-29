# SKBP Pipeline Finder v3.2 — Full Scoring Criteria

## 0. Scoring Operating Principle

각 scoring criterion은 서로 독립적으로 평가한다.

- 공통 scoring rule은 사용하지 않는다.
- 한 criterion의 점수를 다른 criterion에 자동 반영하지 않는다.
- 모든 score는 반드시 `0`, `1`, `2`, `3` 중 하나의 단일 정수로 부여한다.
- `0~1`, `1~2`, `2~3` 같은 범위형 점수는 사용하지 않는다.
- 판단이 애매한 경우에도 가장 가까운 단일 score를 선택하고 불확실성은 reason, investigation_note, uncertain_points에 기재한다.
- 모든 criterion에는 Evidence Type을 함께 표기한다.
- Evidence Type은 score를 자동 결정하는 rule이 아니라 해당 score의 근거 수준을 보여주는 audit label이다.

## 1. Evidence Type

| Evidence Type | Definition | Examples |
|---|---|---|
| **E0. Not found / Not assessable** | 신뢰 가능한 근거가 없거나 판단 불가 | target 미공개, MoA 미공개, 경쟁 정보 확인 불가 |
| **E1. Company claim or scientific rationale only** | 회사 주장, 과학적 논리, plausible rationale은 있으나 실험값/임상값은 공개되지 않음 | “BBB penetrant”, “highly selective”, “AI-powered” claim |
| **E2. Indirect or class-level evidence** | 동일 target, 동일 MoA class, 경쟁 asset, 문헌, 질환 biology 등 간접 근거 | 같은 MoA 승인약, competitor 논문, disease biology 논문 |
| **E3. Asset-specific preclinical or technical evidence** | 평가 대상 asset 자체의 전임상/기술 근거 | 해당 asset의 in vitro, in vivo, PK/PD, selectivity, delivery, tox, CMC |
| **E4. Asset-specific clinical evidence** | 평가 대상 asset 자체의 임상 근거 | 해당 asset의 Phase 1 PK/PD, human biomarker, Phase 2 efficacy |

Asset-specific evidence는 현재 평가 중인 바로 그 asset에 대해 나온 근거다. 경쟁 asset 또는 같은 MoA 승인약의 근거는 class-level/indirect evidence이며 평가 asset의 Data Maturity를 직접 올리지 않는다.

## 2. Summary Scoring Table

| Criterion | What this criterion evaluates | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|
| Target Relevance | Target / MoA / indication이 SKBP CNS Theme 또는 Cluster에 얼마나 직접 부합하는가 | CNS 거의 무관 | general CNS relevance도 약함 | general neurodegeneration / neuroinflammation / epilepsy relevance | SKBP Theme 또는 Cluster에 정확히 해당 |
| Competitive Landscape | 같은 target / same MoA front runner가 얼마나 많고 FIC/BIC 가능성이 있는가 | 정보 부족 / 판단 불가 / front runner 5개 이상 | 경쟁 제품 2개 이상, 차별화 불명확 | front runner 1~2개, BIC 가능 | front runner 0개 또는 사실상 없음, FIC 가능 |
| MoA Validity | Target을 해당 방식으로 조절하면 disease phenotype이 개선된다는 과학적 근거가 있는가 | MoA 불명확 / 과학적 rationale 없음 | plausible rationale 또는 company claim 중심 | disease-relevant functional evidence 또는 class validation | asset-specific MoA validation 또는 human PoC |
| Platform Attractiveness | 다른 프로그램에도 반복 적용 가능한 platform-level 기술적 우위가 있는가 | Platform 실재 또는 구현 가능성 불명확 | 차별성 claim·이론적 rationale 중심 | Comparator 대비 정량적 기술 우위가 확인되나 단일·전임상 조건에 제한 | Platform 적용 자산 First Patient Dosed 또는 반복성·외부검증 확인 |
| Expansion Potential | 같은 target/MoA/platform으로 인접 indication 확장이 가능한가 | 확장 가능성 없음 | 이론적 확장 가능성만 있음 | 인접 indication과 biology 근거 있음 | 복수 indication/pipeline으로 확장성 확인 |
| Data Maturity | 현재 assessed asset에 stage-appropriate development package가 있는가 | stage/data 확인 불가 또는 data 없음 | stage 대비 data 부족 | stage에 부합하는 data 확인 | stage 대비 decision-ready data package |
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

개별 asset의 개발 성숙도가 아니라 modality, delivery, chemistry, manufacturing 등 underlying technology/platform의 매력도를 평가한다. 핵심 질문은 “이 기술이 실제로 차별적이며 다른 프로그램에도 반복 적용 가능한가?”이다. 같은 platform에 공식 연결된 다른 asset의 데이터도 사용할 수 있다.

- 0: Platform의 실재성, 기술 구현 가능성 또는 성능을 평가할 공개 근거가 없음.
- 1: 회사 claim, 이론적 rationale, 특허, platform diagram 또는 preferred modality라는 사실만 존재하며 적절한 comparator 대비 정량적 기술 데이터가 없음.
- 2: Platform이 주장하는 기술적 장점을 실험·측정으로 직접 검증한 정량 결과가 1건 이상 존재함. 적절한 comparator 대비 delivery, potency, selectivity, durability, safety 또는 manufacturability 중 하나의 개선 수치가 확인되어야 하며, 단일 asset, payload, model, species 또는 회사 자체 전임상 데이터에 제한됨.
- 3: 해당 platform을 사용하는 자산이 실제로 First Patient Dosed를 달성함. 임상 전 예외적 3점은 정량적 기술 우위가 복수 asset, payload, model, species 또는 batch에서 재현되고, peer-reviewed publication, 독립기관 검증 또는 외부 partner의 실제 platform 사용 중 하나가 확인된 경우에만 허용.

#### Platform 2점 기술 데이터의 최소 정의

기술 데이터는 platform이 주장하는 기술적 장점을 실험 또는 측정으로 직접 검증한 정량적 결과다. 다음 내용을 모두 확인할 수 있어야 한다.

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

단독으로 인정하지 않는 것:

- “우수한 BBB penetration” 같은 정성적 회사 주장
- 특허 보유
- MOU 또는 공동연구 발표
- 투자유치
- IND 제출 또는 IND clearance
- ClinicalTrials.gov 등록
- Pipeline asset 수
- 임상단계라는 사실만 존재하는 경우

#### First Patient Dosed 운영 규칙

- 임상 진입 자산이 평가 대상 platform을 사용한다는 공식 근거가 있어야 한다.
- First Patient Dosed는 회사 보도자료, trial update 또는 임상등록 업데이트 등 신뢰 가능한 출처에서 확인되어야 한다.
- 평가 asset이 아니라 같은 platform을 사용하는 다른 asset이 First Patient Dosed를 달성한 경우에도 Platform Attractiveness에는 3점을 줄 수 있다.
- 다른 asset의 First Patient Dosed 또는 임상 데이터는 assessed asset의 Data Maturity에는 반영하지 않는다.
- IND clearance, trial registration, recruitment planned 또는 trial initiation announced만으로는 3점을 주지 않는다.
- First Patient Dosed는 platform의 실제 human implementation을 확인하는 운영 기준이며 임상 효능 입증을 의미하지 않는다.

### 3.5 Expansion Potential

같은 target/MoA/platform으로 인접 indication 확장이 가능한지 평가한다.

- 0: 확장 가능성 없음.
- 1: 이론적 가능성만 있음.
- 2: 인접 indication과 biology 근거 있음.
- 3: 복수 indication/pipeline으로 확장성 확인.

### 3.6 Data Maturity

현재 assessed asset 하나의 stage-appropriate development evidence만 평가한다. 다른 asset 또는 platform-wide data는 이 점수를 올리지 않는다.

- 0: asset-specific experimental/clinical data가 보이지 않거나 stage 검증 불가.
- 1: asset-specific information은 있으나 stage 대비 data package 부족. IND clearance 또는 trial registration만 있고 stage-appropriate package가 보이지 않으면 보통 1점.
- 2: 현재 stage에 부합하는 asset-specific data 확인.
- 3: 현재 stage 기준 decision-ready data package 확인.

First Patient Dosed 자체를 data endpoint로 가점하지 않는다. Assessed asset이 First Patient Dosed했지만 human result가 없으면 실제로 공개된 stage-appropriate package를 기준으로 판단하며, 충분한 IND-enabling/초기 임상 준비 package가 확인되면 일반적으로 2점을 검토하고 공개 package가 부족하면 1점으로 제한한다.

Stage-specific rule:

- Discovery / Early Preclinical: in vitro 일부 = 1, disease assay 또는 early in vivo = 2, in vitro + disease assay + early in vivo + basic PK = 3.
- Preclinical / Lead Optimization: label만 있으면 0, in vitro/simple activity = 1, in vitro + in vivo + PK/PD 중 2종 이상 = 2, efficacy + PK/PD + safety/tox or candidate nomination = 3.
- IND-enabling / Phase 1-ready: claim만 있으면 0, IND/trial approval만 있고 package가 보이지 않으면 1, tox/PK/CMC/safety margin 또는 First Patient Dosed와 함께 적절한 IND-enabling package가 확인되면 2, complete IND-enabling package = 3.
- Phase 1: protocol only = 1, safety/tolerability/PK result = 2, safety + PK + PD/target engagement/CNS exposure = 3.
- Phase 2: protocol only = 1, patient efficacy/biomarker/dose-response/safety 일부 = 2, clinically meaningful efficacy + biomarker/dose-response + safety = 3.
- Phase 3 / Approved: claim only = 1, pivotal result 일부 = 2, pivotal efficacy + safety + regulatory/label-level evidence = 3.

### 3.6.1 Platform Attractiveness vs Data Maturity

Platform Attractiveness는 다른 프로그램에도 반복 적용 가능한 기술적 우위를 평가하고, Data Maturity는 현재 assessed asset의 stage-appropriate development package만 평가한다.

| 데이터 또는 질문 | Platform Attractiveness | Data Maturity |
|---|---|---|
| 다른 asset에서 동일 platform의 성능 확인 | 반영 가능 | 반영 불가 |
| 복수 payload에서 delivery 우위 재현 | 핵심 근거 | 직접 반영하지 않음 |
| assessed asset의 in vitro/in vivo efficacy | platform 기여를 comparator로 분리한 경우만 | 핵심 근거 |
| assessed asset의 dose-response, PK/PD | platform claim을 직접 검증할 때만 보조 반영 | 핵심 근거 |
| 다른 asset의 First Patient Dosed | 3점 가능 | 반영 불가 |
| assessed asset의 First Patient Dosed | 3점 가능 | 초기 임상 stage에 맞는 package로 평가 |
| 다른 asset의 human data | human platform validation으로 반영 가능 | 반영 불가 |
| assessed asset의 human target engagement 또는 PoC | platform claim 관련 endpoint만 반영 | 강한 근거 |
| 공통 제조공정의 수율·batch consistency | Platform 근거 | 직접 반영하지 않음 |
| assessed asset의 GLP tox·clinical batch·release assay | 공통 platform 특성이 아니면 제한적 | 핵심 근거 |
| MOU·투자·특허·IND clearance | 단독 가점 불가 | asset data로 가점 불가 |

동일 source를 두 criterion에서 인용하는 것은 가능하지만 동일 endpoint를 양쪽에 중복 가점하지 않는다.

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
- Broad disease market은 크지만 해당 asset이 그 market에 들어갈 논리가 없다.

Commercial rationale이 성립하지 않으면 Marketability는 0점이고 TAP / Unrisked Peak Sales / Obtainable Peak Sales는 null로 표기한다.

계산 가능하면:

- TAP = Total Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate
- Unrisked Peak Sales = TAP x Annual Net Price x Peak Penetration x Treatment Duration Factor
- Obtainable Peak Sales = Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment x Expansion Capacity Adjustment

Score:

- 0: Commercial rationale cannot be established, or Obtainable Peak Sales cannot be reasonably calculated.
- 1: Obtainable Peak Sales < USD 1B.
- 2: Obtainable Peak Sales >= USD 1B and < USD 2B.
- 3: Obtainable Peak Sales >= USD 2B with credible expansion, pricing power, or differentiation.

Controlled vocabulary:

- `scoring.criteria.marketability.calculation.commercial_rationale_status` must be exactly one of:
  - `"established"`: TAP / Unrisked Peak Sales / Obtainable Peak Sales were calculated.
  - `"not_established"`: Commercial calculations could not be reasonably performed.
  - `"evidence_based"`
  - `"assumption_based"`
  - `"assumption_based_scenario"`
  - `"insufficient_evidence"`
- Do not use values such as `provisional`, `uncertain`, `partial`, or `pending`.
- Put uncertainty in `commercial_rationale_failure_reason`, `investigation_note`, or `uncertain_points`.
- If status is `not_established` or `insufficient_evidence`, keep A/B/C calculated fields null and provide a clear rationale.

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
