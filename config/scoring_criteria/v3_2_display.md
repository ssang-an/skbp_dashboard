# 판단근거 — SKBP Pipeline Finder v3.2

## Scoring 원칙

- 공통 scoring rule은 사용하지 않습니다.
- 모든 점수는 `0`, `1`, `2`, `3` 중 하나로만 부여합니다.
- 점수 범위형 표기(`1~2`, `2~3`)는 사용하지 않습니다.
- Evidence Type은 해당 점수가 어떤 수준의 근거에 기반했는지 보여주는 audit label이며 점수를 자동 결정하지 않습니다.

## Evidence Type

| Type | 의미 |
|---|---|
| **E0** | 근거 없음 / 판단 불가 |
| **E1** | 회사 주장 또는 과학적 논리만 있음 |
| **E2** | class-level / indirect evidence |
| **E3** | asset-specific 전임상/기술 근거 |
| **E4** | asset-specific 임상 근거 |

## Summary Scoring Table

| Criterion | 무엇을 보는가 | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|
| **Target Relevance** | SKBP CNS Theme / Cluster에 얼마나 직접 맞는가 | CNS 거의 무관 | CNS 관련성 약함 | general CNS relevance | Theme 또는 Cluster 직접 해당 |
| **Competitive Landscape** | same target / same MoA front runner 수와 FIC/BIC 가능성 | 정보 부족 또는 front runner 5개 이상 | 경쟁 2개 이상, 차별화 불명확 | front runner 1~2개, BIC 가능 | front runner 없음, FIC 가능 |
| **MoA Validity** | 기전이 disease phenotype을 바꿀 과학적 근거가 있는가 | MoA 불명확 | rationale/claim 중심 | functional evidence 또는 class validation | asset-specific validation 또는 human PoC |
| **Platform Attractiveness** | 다른 프로그램에도 반복 적용 가능한 기술적 우위가 있는가 | Platform 실재 또는 구현 가능성 불명확 | 차별성 claim·이론적 rationale 중심 | Comparator 대비 정량적 기술 우위가 확인되나 단일·전임상 조건에 제한 | Platform 적용 자산 First Patient Dosed 또는 반복성·외부검증 확인 |
| **Expansion Potential** | 인접 indication 확장 가능성이 있는가 | 확장 근거 없음 | 이론적 가능성 | biology 근거 있음 | 복수 indication/pipeline 확인 |
| **Data Maturity** | 현재 assessed asset의 stage-appropriate data package가 있는가 | data 없음 | stage 대비 부족 | stage에 부합 | decision-ready package |
| **Marketability** | commercial product와 peak sales가 성립하는가 | 상업적 rationale/계산 불가 | < USD 1B | USD 1B-2B | >= USD 2B + 확장성/가격/차별성 |

## Platform Attractiveness 상세 Parameter Guide

Platform Attractiveness는 다른 프로그램에도 반복 적용 가능한 기술적 우위를 평가하고, Data Maturity는 현재 assessed asset의 stage-appropriate development package만 평가합니다.

| 점수 | 상세 기준 |
|---|---|
| **0점** | Platform의 실재성, 기술 구현 가능성 또는 성능을 평가할 공개 근거가 없음 |
| **1점** | 회사 claim, 이론적 rationale, 특허, platform diagram 또는 preferred modality라는 사실만 존재하며, 적절한 comparator 대비 정량적 기술 데이터가 없음 |
| **2점** | Platform의 기술적 장점을 실험·측정으로 직접 검증한 정량 결과가 1건 이상 존재함. 적절한 comparator 대비 delivery, potency, selectivity, durability, safety 또는 manufacturability 중 하나의 개선 수치가 확인되어야 하며, 단일 asset, payload, model, species 또는 회사 자체 전임상 데이터에 제한됨 |
| **3점** | 해당 platform을 사용하는 자산이 실제로 **First Patient Dosed**를 달성함. 임상 전 예외적 3점은 정량적 기술 우위가 복수 asset, payload, model, species 또는 batch에서 재현되고, peer-reviewed publication, 독립기관 검증 또는 외부 partner의 실제 platform 사용 중 하나가 확인된 경우에만 허용 |

### 2점 기술 데이터의 최소 정의

다음 정보를 모두 확인할 수 있는 정량적 실험·측정 결과여야 합니다.

1. 평가 asset 또는 payload와 platform의 연결
2. 정량적 endpoint
3. 적절한 comparator
4. model, species, dose, route, time point 등 실험 맥락
5. delivery, potency, selectivity, durability, safety, manufacturability 중 검증한 기술적 장점

인정 가능한 예: AAV9 대비 brain expression 8배 증가, parent siRNA 대비 target knockdown 25%에서 70%로 개선, comparator 대비 liver exposure 80% 감소, 기존 공정 대비 생산수율 3배 증가, 동일 효능에서 투여량 5분의 1 감소.

정성적 회사 주장, 특허, MOU·공동연구 발표, 투자유치, IND 제출·clearance, trial registration, pipeline asset 수 또는 임상단계라는 사실만으로는 기술 데이터로 인정하지 않습니다.

### First Patient Dosed 운영 규칙

- 임상 진입 자산이 평가 대상 platform을 사용한다는 공식 근거가 있어야 합니다.
- First Patient Dosed는 회사 보도자료, trial update 또는 임상등록 업데이트로 확인해야 합니다.
- 같은 platform의 다른 asset이 First Patient Dosed를 달성해도 Platform Attractiveness는 3점이 가능하지만 assessed asset의 Data Maturity에는 반영하지 않습니다.
- IND clearance, trial registration, recruitment planned 또는 trial initiation announced만으로는 3점을 주지 않습니다.
- First Patient Dosed는 human implementation을 확인하는 운영 기준이며 임상 효능 입증을 의미하지 않습니다.

## Platform vs Data Maturity 구분표

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

동일 source를 두 criterion에서 인용할 수는 있지만 동일 endpoint를 양쪽에 중복 가점하지 않습니다.

## 나머지 핵심 해석 기준

### Target Relevance
SKBP Theme 또는 Cluster에 정확히 해당하면 3점을 우선 부여합니다. CNS와 간접적으로만 관련되면 1~2점으로 제한합니다.

### Competitive Landscape
먼저 same target / same MoA front runner 수를 셉니다. 경쟁 정보 부족은 “경쟁 없음”이 아니라 “판단 불가”이므로 0점입니다.

### MoA Validity
2점 이상은 disease-relevant functional evidence 또는 class validation이 필요합니다.

### Expansion Potential
Main indication을 다른 말로 표현한 것은 expansion으로 보지 않습니다. 같은 biology가 다른 indication에서도 작동할 근거가 필요합니다.

### Data Maturity
현재 assessed asset의 stage-appropriate evidence만 평가합니다. Platform-wide 또는 다른 asset의 data는 점수를 올리지 않습니다. Assessed asset이 First Patient Dosed했지만 human result가 없으면 충분한 IND-enabling/초기 임상 준비 package가 확인될 때 일반적으로 2점을 검토하고, 공개 package가 부족하면 1점으로 제한합니다.

### Marketability
상업적 rationale이 성립하지 않으면 TAP/peak sales를 억지로 계산하지 않고 0점 처리합니다.
