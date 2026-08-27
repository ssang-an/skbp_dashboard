# 판단근거 — SKBP Pipeline Finder v3.5

## Scoring 원칙

- 확인된 사용자 입력정보 또는 credible public source의 asset-specific 사실만 사용합니다.
- 계획·예상·정황은 현재 사실이나 완료 milestone로 간주하지 않습니다.
- 확인할 수 없거나 source 충돌을 해소할 수 없으면 `Unknown`으로 표시합니다.
- 각 항목은 독립적으로 평가하고 `0점`, `1점`, `2점`, `3점` 중 하나의 단일 점수만 부여합니다.
- Evidence Type은 근거 수준을 보여주는 audit label이며 점수를 자동 결정하지 않습니다.

## SKBP Interest Indications

- Alzheimer's disease
- Parkinson's disease
- Amyotrophic lateral sclerosis / motor neuron disease
- Multiple sclerosis / neuroinflammatory disease
- Neuropathic pain
- Epilepsy / seizure disorders

## R&D Theme Taxonomy

- `E/I Balance`
- `Neuroimmune`
- `Protein Homeostasis`: target/MoA가 protein folding/chaperone, ubiquitin-proteasome, autophagy-lysosome, ER stress/UPR 또는 pathogenic aggregate clearance를 직접 조절할 때만 적용

질환에 단백질 응집이 존재한다는 사실만으로 Protein Homeostasis로 분류하지 않습니다. 승인된 하위 Cluster taxonomy가 생기기 전까지 Cluster는 `Unknown`으로 표시합니다.

## Summary Scoring Table

| Criterion | 무엇을 보는가 | 0점 | 1점 | 2점 | 3점 |
|---|---|---|---|---|---|
| **Target Relevance** | 확인된 asset의 indication과 SKBP 전략 범위 적합성 (Theme/Cluster와 disease biology는 별도 분류/MoA 평가) | Identity 확인 후에도 indication/relevance 판단 정보 부족 (identity 미확인은 조기 종료) | 넓은 SKBP 범위 밖 | 넓은 SKBP 범위 내이나 6개 우선 적응증 밖 | 6개 우선 적응증 중 하나 |
| **Competitive Landscape** | same target/same MoA 경쟁과 FIC/BIC 가능성 | 정보 부족 또는 front runner 5개 이상 | front runner 3~4개 | front runner 1~2개 | front runner 없음 |
| **MoA Validity** | 기전의 구체성과 기능적·과학적 검증 수준 | target/MoA 확인 불가 | claim·이론 중심 | functional evidence 또는 same target/class 독립 검증 | asset-specific target engagement/PD/직접 검증 |
| **Platform Attractiveness** | 반복 적용 가능한 platform 기술 우위 | 실재/구현 근거 불명확 | claim·이론 중심 | comparator 대비 정량 우위 | 2점 근거 충족 후 복수 조건·platform 적용 자산에서 정량 우위 재현 및 외부 검증/사용, 또는 human implementation |
| **Expansion Potential** | assessed asset의 main indication 외 확장성 | 추가 indication 근거 없음 | biology rationale만 있음 | 추가 indication에서 asset-specific 초기 정량 data | 복수 추가 indication + 최소 1개 공식 전임상·IND-enabling·임상 program + 해당 indication 정량 data |
| **Data Maturity** | stage에 맞는 공개 data의 충분성과 해석 가능성 | asset-specific 결과 없음 | 정성 claim·단편 결과 | 정량 evidence domain 1개 이상 | 상호보완적·stage-appropriate 정량 domain 2개 이상 + 최소 1개 program progression 직접 지지 |
| **Marketability** | commercial product와 Global obtainable peak sales 성립성 | rationale/신뢰 가능한 산출 불가 | Global < USD 1B | Global USD 1B–2B | Global ≥ USD 2B |

## Parameter Guide

### Target Relevance

확인된 asset의 indication이 SKBP 전략 범위와 얼마나 맞는지 평가합니다. 6개 우선 적응증이면 TR 3점, 넓은 신경계·정신과·신경면역·신경퇴행·통증 범위 안이지만 비우선 적응증이면 TR 2점, 그 밖이면 TR 1점입니다. Target/MoA의 disease-biology 연결성은 MoA Validity에서 평가합니다.

### MoA Validity

작용기전이 얼마나 구체적으로 정의되어 있고, 이를 뒷받침하는 기능적·과학적 근거가 어느 수준인지 평가합니다. 일반 clinical efficacy만으로 3점을 부여하지 않으며 mechanism-linked PoC가 필요합니다.

- Functional evidence: target/pathway 조절 후 예상되는 기능적 또는 downstream biological effect가 확인된 근거
- Same target/class validation: 다른 약물, 독립 연구 또는 동일 class의 검증 근거
- Asset-specific validation: 해당 asset의 target engagement, mechanism-linked PD/biomarker 또는 직접 functional effect

### Data Maturity

해당 asset의 개발 단계에 맞는 공개 데이터가 얼마나 충분하고 해석 가능한지 평가합니다. 동일 experiment의 endpoint·dose·figure 또는 반복 source는 하나의 domain으로 계산하고, potency와 selectivity도 하나의 in vitro characterization domain으로 봅니다. 3점은 상호보완적인 stage-appropriate 정량 domain 두 개 이상과 그중 program progression을 직접 뒷받침하는 domain 하나 이상이 필요합니다. Human data는 필수조건이 아닙니다.

### Platform Attractiveness

다른 프로그램에도 반복 적용 가능한 기술적 우위를 평가합니다. 정성 claim, 특허, 투자, IND clearance만으로는 정량 기술 검증이 되지 않습니다.

### Competitive Landscape

Broader same-disease competitor와 true same-target/same-MoA front runner를 구분합니다. 정보 부족은 경쟁 없음이 아니라 판단 불가입니다.

### Expansion Potential

Main indication의 다른 표현, patient subgroup, platform-wide indication list 또는 미래 계획은 expansion이 아닙니다. 2점은 assessed asset의 추가 indication asset-specific 초기 정량 data가, 3점은 복수 추가 indication과 최소 1개 공식 전임상·IND-enabling·임상 program 및 해당 indication 정량 data가 필요합니다.

### Marketability

Commercial rationale이 성립하지 않으면 TAP/peak sales를 억지로 계산하지 않고 0점 처리합니다.

- A. US TAP
- B. US Unrisked Peak Sales
- C. US Obtainable Peak Sales
- D. Global Obtainable Peak Sales = C × 1.5

미국 기준 계산값 또는 미국 기준 외부 forecast에만 `×1.5`를 정확히 한 번 적용합니다. 이미 Global인 forecast에는 재적용하지 않으며, 최종 점수는 assessed Global peak sales를 기준으로 판정합니다.

## Hard Filter

PASS는 총점 14점 이상, TR 2점 이상, MoA 3점, Data 3점이 모두 필요합니다. FAIL은 총점 8점 이하 또는 TR/MoA/Data 중 하나가 0점이며, REVIEW는 그 밖의 완료 평가입니다. Theme/Cluster direct fit은 PASS/FAIL 점수 근거가 아닙니다. decision-critical uncertainty는 criterion notes에 기록하지만 완료 평가의 score-based PASS를 독립적으로 막지 않습니다.
