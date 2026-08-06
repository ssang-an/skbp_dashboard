# 판단근거 — SKBP Pipeline Finder v3.3

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

## Summary Scoring Table

| Criterion | 무엇을 보는가 | 0점 | 1점 | 2점 | 3점 |
|---|---|---|---|---|---|
| **Target Relevance** | SKBP 우선 관심 적응증 및 R&D Theme/Cluster 적합성 | 판단 정보 부족 또는 관심 질환 범위 밖 | 관련 CNS 질환이나 우선 관심 적응증 아님 | 우선 관심 적응증에 해당 | 우선 관심 적응증이며 target/MoA가 질환 biology 또는 Theme/Cluster에 직접 연결 |
| **Competitive Landscape** | same target/same MoA 경쟁과 FIC/BIC 가능성 | 정보 부족 또는 front runner 5개 이상 | front runner 3~4개 | front runner 1~2개 | front runner 없음 |
| **MoA Validity** | 기전의 구체성과 기능적·과학적 검증 수준 | target/MoA 확인 불가 | claim·이론 중심 | functional evidence 또는 same target/class 독립 검증 | asset-specific target engagement/PD/직접 검증 |
| **Platform Attractiveness** | 반복 적용 가능한 platform 기술 우위 | 실재/구현 근거 불명확 | claim·이론 중심 | comparator 대비 정량 우위 | human implementation 또는 반복성·외부검증 |
| **Expansion Potential** | 인접 indication 확장성 | 근거 없음 | 이론적 가능성 | biology 근거 있음 | 복수 indication/pipeline 확인 |
| **Data Maturity** | stage에 맞는 공개 data의 충분성과 해석 가능성 | asset-specific 결과 없음 | 정성 claim·단편 결과 | 정량 evidence domain 1개 이상 | 상호보완 정량 domain 2개 이상 |
| **Marketability** | commercial product와 Global obtainable peak sales 성립성 | rationale/신뢰 가능한 산출 불가 | Global < USD 1B | Global USD 1B–2B | Global ≥ USD 2B |

## Parameter Guide

### Target Relevance

SKBP 우선 관심 적응증 및 R&D Theme/Cluster와의 적합성을 평가합니다. 상세 indication이 interest indication이면 TR 2점이 가능하며, target/MoA의 direct biology 또는 Theme/Cluster 연결까지 확인될 때 TR 3점입니다. Undisclosed target/MoA는 contradiction이 아닙니다.

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

Main indication의 다른 표현은 expansion이 아닙니다. 같은 biology가 다른 indication에서도 작동할 근거가 필요합니다.

### Marketability

Commercial rationale이 성립하지 않으면 TAP/peak sales를 억지로 계산하지 않고 0점 처리합니다.

- A. US TAP
- B. US Unrisked Peak Sales
- C. US Obtainable Peak Sales
- D. Global Obtainable Peak Sales = C × 1.5

미국 기준 계산값 또는 미국 기준 외부 forecast에만 `×1.5`를 정확히 한 번 적용합니다. 이미 Global인 forecast에는 재적용하지 않으며, 최종 점수는 assessed Global peak sales를 기준으로 판정합니다.

## Hard Filter

기존 Full Scout PASS/REVIEW/FAIL threshold를 유지합니다. SKBP Theme/Cluster direct fit이 없다는 이유만으로 자동 FAIL 처리하지 않습니다.
