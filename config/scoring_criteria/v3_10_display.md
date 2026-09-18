# 판단근거 — SKBP Pipeline Finder v3.10

This display release reflects the active Advanced Research v3.9 decision rules, including the `Global Obtainable Peak Sales` calculation using the `1.5` US-to-global multiplier, the identity/lifecycle-as-pre-research-gate framing, the MoA 2/3 clarification, the Competitive Landscape comparator-backed direct-comparison requirement for Score 3, and the Expansion Potential program-plus-data requirement for Score 3. Criteria are presented Target Relevance / MoA Validity / Data Maturity first (the three Simple Research-shared criteria), then Competitive Landscape / Platform Attractiveness / Expansion Potential / Marketability, matching the Pipeline Table and Team Review Workspace order.

## Scoring 원칙

- Advanced Research 지침·평가는 v3.9이며 Display 문서 버전은 v3.10을 유지합니다. v3.8 대비 점수·판정 규칙 변경 없이 CoM 기본 만료연도와 예상 출시연도의 선택 컬럼만 추가했습니다. 두 항목은 점수에 영향을 주지 않으며, 근거는 원문에서 확인합니다. 과거 원문의 해당 항목 부재는 `미조사`, 조사 후 미확인은 `확인 불가`로 구분합니다.
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

## Criterion Score Reminders

- **TR:** 0 is only for an identity-verified asset with insufficient indication/relevance information; 1 is outside the neurologic, psychiatric, neuroimmune, neurodegenerative, or pain scope; 2 is within that scope but outside the six priority indications; 3 is one of the six priority indications. Identity not verified is an early stop, not TR 0.
- **MoA 2 / 3:** MoA 2 is supported by target/pathway functional evidence or independent same-target/class validation. MoA 3 has direct asset-specific evidence relevant to the proposed MoA through one or more of target engagement, a mechanism-linked PD/biomarker, or a direct functional effect. Target engagement is not mandatory.
- **MoA investigation note:** for Score 2 or 3, state in one sentence whether the already-scored evidence connects to a disease-relevant phenotype, efficacy, or biomarker, or remains limited to a proximal measure such as a cellular-signaling marker. Do not add this statement for Score 0 or 1. If existing evidence is insufficient, write `확인 불가`; do not infer or perform a new search for this note.
- **Data 3:** at least two complementary, stage-appropriate quantitative domains, including at least one domain that directly supports program progression.
- **Competitive Landscape 2 / 3:** 2 requires asset-specific quantitative differentiation versus an appropriate benchmark comparator or a substantiated entry space. 3 requires that 2-point evidence plus assessed-asset direct head-to-head quantitative evidence against an appropriate comparator in matched or comparable conditions confirming material advantage. Material advantage is a decision-relevant quantitative difference versus that comparator, not a trivial numerical difference. Never 3 from a cross-study comparison, claim, no-competitor finding, or competitor count alone.
- **Platform 2 / 3:** 2 requires at least one quantitative technical advantage versus an appropriate comparator, normally limited to one condition or platform-derived asset. 3 first requires that 2-point evidence, then either reproduction of the same advantage across multiple independent conditions (for example, model, species, or dose) or officially linked platform-derived assets, or First Patient Dosed by an officially linked platform-derived asset. First Patient Dosed alone is insufficient.
- **Expansion 2 / 3:** 2 requires asset-specific early quantitative data in at least one additional indication. 3 requires an official preclinical, IND-enabling, or clinical program and asset-specific quantitative data in the same additional indication; multiple additional indications are not required.
- **Expansion investigation note:** for Score 1–3, state whether confirmed additional indications are single or multiple and briefly give each indication's assessed-asset program/data status. Use only evidence already scored; if insufficient, write `확인 불가` without inference or a new search.
- **Marketability:** assessed Global peak sales determines 1/2/3; Expansion Capacity Adjustment is not used.

## Summary Scoring Table

| Criterion | 무엇을 보는가 | 0점 | 1점 | 2점 | 3점 |
|---|---|---|---|---|---|
| **Target Relevance** | 확인된 asset의 indication과 SKBP 전략 범위 적합성 (Theme/Cluster와 disease biology는 별도 분류/MoA 평가) | Identity 확인 후에도 indication/relevance 판단 정보 부족 (identity 미확인은 조기 종료) | 신경계·정신과·신경면역·신경퇴행·통증 범위 밖 | 신경계·정신과·신경면역·신경퇴행·통증 범위에는 속하지만 6개 우선 적응증 밖 | 6개 우선 적응증 중 하나 |
| **MoA Validity** | 기전의 구체성과 기능적·과학적 검증 수준 | target/MoA 확인 불가 | claim·이론 중심 | Target/pathway functional evidence 또는 independent same-target/class validation | Direct asset-specific evidence relevant to the proposed MoA (target engagement, mechanism-linked PD/biomarker, or direct functional effect) |
| **Data Maturity** | stage에 맞는 공개 data의 충분성과 해석 가능성 | asset-specific 결과 없음 | 정성 claim·단편 결과 | 정량 evidence domain 1개 이상 | 상호보완적·stage-appropriate 정량 domain 2개 이상 + 최소 1개 program progression 직접 지지 |
| **Competitive Landscape** | comparator 대비 확인된 차별성과 현실적 진입 가능성 | comparator와 경쟁구도 판단 불가 | 경쟁자는 확인되나 차별성은 claim 또는 이론 수준 | 적절한 benchmark comparator 대비 asset-specific 정량 차별성, 또는 asset-specific 근거로 확인된 현실적 진입공간 | 2점 조건 + 적절한 comparator와 직접 head-to-head 정량 비교로 material advantage 확인 |
| **Platform Attractiveness** | 반복 적용 가능한 platform 기술 우위 | 실재/구현 근거 불명확 | claim·이론 중심 | 적절한 comparator 대비 정량 기술 우위 1건 (단일 조건 또는 단일 platform 적용 asset 수준) | 2점 조건 충족 + (같은 우위가 복수 독립 조건 또는 복수 공식 연결 platform 적용 asset에서 재현됨, 또는 공식 연결 platform 적용 asset First Patient Dosed) |
| **Expansion Potential** | assessed asset의 main indication 외 확장성 | 추가 indication 근거 없음 | biology rationale만 있음 | 하나 이상의 추가 indication에서 assessed asset의 초기 정량 efficacy·PD·biomarker data 확인 | 2점 조건 + 그 추가 indication에서 assessed asset의 공식 전임상·IND-enabling·임상 program 확인 |
| **Marketability** | commercial product와 Global obtainable peak sales 성립성 | rationale/신뢰 가능한 산출 불가 | Global < USD 1B | Global USD 1B–2B | Global ≥ USD 2B |

## Parameter Guide

### Target Relevance

확인된 asset의 indication이 SKBP 전략 범위와 얼마나 맞는지 평가합니다. 6개 우선 적응증이면 TR 3점, 넓은 신경계·정신과·신경면역·신경퇴행·통증 범위 안이지만 비우선 적응증이면 TR 2점, 그 밖이면 TR 1점입니다. Target/MoA의 disease-biology 연결성은 MoA Validity에서 평가합니다.

### MoA Validity

작용기전이 얼마나 구체적으로 정의되어 있고, 이를 뒷받침하는 기능적·과학적 근거가 어느 수준인지 평가합니다. 2점은 target/pathway functional evidence 또는 independent same-target/class validation으로 성립합니다. 3점은 target engagement, mechanism-linked PD/biomarker, 직접 functional effect 중 하나 이상의 직접 asset-specific MoA 관련 근거로 성립하며 target engagement가 필수는 아닙니다. 일반 clinical efficacy만으로 3점을 부여하지 않으며 mechanism-linked PoC가 필요합니다.

2점 또는 3점이면 `investigation_note`에 기존 점수 근거가 disease-relevant phenotype·efficacy·biomarker 연결인지, 또는 세포신호 marker 등 proximal 지표 수준인지를 한 문장 이내로 기록합니다. 0점 또는 1점에는 이 구분을 쓰지 않으며, 기존 근거로 판단할 수 없으면 `확인 불가`로 기록합니다.

- Functional evidence: target/pathway 조절 후 예상되는 기능적 또는 downstream biological effect가 확인된 근거
- Same target/class validation: 다른 약물, 독립 연구 또는 동일 class의 검증 근거
- Asset-specific validation: 해당 asset의 target engagement, mechanism-linked PD/biomarker 또는 직접 functional effect

### Data Maturity

해당 asset의 개발 단계에 맞는 공개 데이터가 얼마나 충분하고 해석 가능한지 평가합니다. 동일 experiment의 endpoint·dose·figure 또는 반복 source는 하나의 domain으로 계산하고, potency와 selectivity도 하나의 in vitro characterization domain으로 봅니다. 3점은 상호보완적인 stage-appropriate 정량 domain 두 개 이상과 그중 program progression을 직접 뒷받침하는 domain 하나 이상이 필요합니다. Human data는 필수조건이 아닙니다.

### Competitive Landscape

Broader/reference competitor와 direct competitor를 검색 기록에서 구분합니다. Direct competitor는 주 적응증, target/pathway intervention, therapeutic effector mechanism이 모두 실질적으로 겹치는 경우이며, 이 분류와 경쟁자 수는 점수를 자동 결정하지 않습니다. 2점의 현실적 진입공간은 단순 unmet need가 아니라 기존 치료의 뚜렷한 미충족 수요를 assessed asset의 target/MoA·route·safety 또는 접근성 근거로 해결할 가능성이 확인된 경우입니다. 3점은 2점 근거에 더해 적절한 comparator와 동일하거나 비교 가능한 조건의 직접 head-to-head 정량 비교로 material advantage가 확인돼야 합니다. Material advantage는 해당 comparator 대비 의사결정에 의미 있는 크기의 정량 우위이며, 사소한 수치 차이만으로는 충족하지 않습니다. 정보 부족은 경쟁 없음이 아니라 판단 불가입니다.

### Platform Attractiveness

다른 프로그램에도 반복 적용 가능한 기술적 우위를 평가합니다. 2점은 적절한 comparator 대비 정량 기술 우위 1건이지만 단일 조건 또는 단일 platform 적용 asset 수준에 머문 경우입니다. 3점은 그 2점 근거를 전제로, (a) 같은 우위가 복수의 독립 조건(예: 모델·종·용량) 또는 복수의 공식 연결 platform 적용 asset에서 재현되거나, (b) 공식 연결 platform 적용 asset의 First Patient Dosed가 확인된 경우입니다. First Patient Dosed만으로는 3점이 아니며, 정성 claim·특허·투자·IND clearance도 정량 기술 검증이 아닙니다.

### Expansion Potential

Main indication의 다른 표현, patient subgroup, platform-wide indication list 또는 미래 계획은 expansion이 아닙니다. 2점은 하나 이상의 추가 indication에서 assessed asset의 초기 정량 efficacy·PD·biomarker data가 확인된 경우이고, 3점은 2점 조건을 충족하면서 그 추가 indication에서 assessed asset의 공식 전임상·IND-enabling·임상 program이 확인된 경우입니다. 복수 추가 indication은 요구하지 않습니다.

1점 이상이면 `investigation_note`에 확인된 추가 indication이 단일인지 복수인지와 각 indication의 assessed-asset program/data 상태를 간단히 기록합니다. 이는 기존 점수 근거의 요약이며, 판단할 수 없으면 `확인 불가`로 기록하고 새 검색이나 추측을 하지 않습니다.

### Marketability

Commercial rationale이 성립하지 않으면 TAP/peak sales를 억지로 계산하지 않고 0점 처리합니다.

- A. US TAP
- B. US Unrisked Peak Sales
- C. US Obtainable Peak Sales
- D. Global Obtainable Peak Sales = C × 1.5

미국 기준 계산값 또는 미국 기준 외부 forecast에만 `×1.5`를 정확히 한 번 적용합니다. 이미 Global인 forecast에는 재적용하지 않으며, 최종 점수는 assessed Global peak sales를 기준으로 판정합니다.

## Advanced Research Status

Identity 및 lifecycle 확인은 본조사 전 pre-research gate로 처리합니다. Asset identity 미확인 또는 영구 중단이 확인되면 조사 전 조기 종료하며, 이 경우에는 상세 점수 대신 `—`로 표시합니다 (JSON의 schema placeholder 0점을 완료 평가로 서술하지 않습니다).

Identity가 확인되고 영구 중단이 아닌 완료 평가에는 다음을 적용합니다.

- **PASS:** 총점 14점 이상, TR 3점 이상, MoA 3점, Data 3점
- **FAIL:** 총점 8점 이하 또는 TR·MoA·Data 중 하나가 0점
- **REVIEW:** 위 PASS/FAIL 어느 쪽에도 해당하지 않는 완료 평가

Theme/Cluster direct fit은 PASS/FAIL 점수 근거가 아닙니다. decision-critical uncertainty는 criterion notes에 기록하지만 완료 평가의 score-based PASS를 독립적으로 막지 않습니다. 확인된 hard blocker는 안전상 FAIL 조건으로 유지합니다.
