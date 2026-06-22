# 판단근거 — SKBP Pipeline Finder v3.1

## Scoring 원칙

- 각 항목은 독립적으로 평가합니다.
- 공통 scoring rule은 사용하지 않습니다.
- 모든 점수는 `0`, `1`, `2`, `3` 중 하나로만 부여합니다.
- 점수 범위형 표기(`1~2`, `2~3`)는 사용하지 않습니다.
- Evidence Type은 해당 점수가 어떤 수준의 근거에 기반했는지 보여주는 audit label입니다.
- Evidence Type은 점수를 자동 결정하지 않습니다.

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
| **Platform Attractiveness** | modality/platform이 실질적 차별성을 주는가 | 식별 불가 또는 rationale 없음 | claim/논리 중심 | 기술적 차별화 논리 명확 | data 또는 외부 검증으로 입증 |
| **Expansion Potential** | 인접 indication 확장 가능성이 있는가 | 확장 근거 없음 | 이론적 가능성 | biology 근거 있음 | 복수 indication/pipeline 확인 |
| **Data Maturity** | 현재 stage에 맞는 asset-specific data가 있는가 | data 없음 | stage 대비 부족 | stage에 부합 | decision-ready package |
| **Marketability** | commercial product와 peak sales가 성립하는가 | 상업적 rationale/계산 불가 | < USD 1B | USD 1B-2B | >= USD 2B + 확장성/가격/차별성 |

## 핵심 해석 기준

### 1. Target Relevance
SKBP Theme 또는 Cluster에 정확히 해당하면 3점을 우선 부여합니다. 다만 CNS와 간접적으로만 관련되면 1~2점으로 제한합니다.

### 2. Competitive Landscape
먼저 same target / same MoA front runner 수를 셉니다. 경쟁 정보 부족은 “경쟁 없음”이 아니라 “판단 불가”이므로 0점입니다.

### 3. MoA Validity
Target이 좋아도 MoA가 유효하다는 뜻은 아닙니다. 2점 이상은 disease-relevant functional evidence 또는 class validation이 필요합니다.

### 4. Platform Attractiveness
공개 data가 없다는 이유만으로 0점은 아닙니다. Scientific / technical rationale이 명확하면 1~2점이 가능합니다.

### 5. Expansion Potential
Main indication을 다른 말로 표현한 것은 expansion으로 보지 않습니다. 같은 biology가 다른 indication에서도 작동할 근거가 필요합니다.

### 6. Data Maturity
현재 development stage에 맞는 asset-specific data가 있는지를 봅니다. Clinical stage label만으로 2점 이상을 주지 않습니다. Trial registration 또는 first dosing만 있으면 보통 1점입니다.

### 7. Marketability
먼저 commercial product hypothesis가 성립해야 합니다. 상업적 rationale이 성립하지 않으면 TAP/peak sales를 억지로 계산하지 않고 0점 처리합니다.
