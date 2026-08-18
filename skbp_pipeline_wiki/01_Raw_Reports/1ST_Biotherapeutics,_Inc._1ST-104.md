# 1ST Biotherapeutics Pipeline Scout Report: **1ST-104**

본 보고서는 GPT instruction 2 — Full Scout v3.4 (schema v3.2)에 따라 attachment review, public-source verification, competitor search 및 7개 criterion scoring을 수행했으며, auditability를 위해 확인한 URL을 포함합니다. :contentReference[oaicite:0]{index=0}

**중요: 1ST-104는 공식 pipeline과 제공자료에서 Parkinson's disease용 LRRK2/c-Abl dual inhibitor 프로그램으로 확인되고 active lead-optimization program으로 판단되나, 총점 12/21로 REVIEW / Watch입니다. Preclinical target/PK profile은 흥미롭지만 candidate가 아직 공식 nomination되지 않았고, in vivo efficacy·1ST-104 자체 반복독성·human data가 없으며, 최근 LRRK2 및 c-Abl 임상 실패 사례와 시장성 산정 불확실성이 남아 있습니다.**

---

## 1) Company Profile

| Field | Content | Evidence |
|---|---|---|
| Company | 1ST Biotherapeutics, Inc. | [1], [3] |
| Legal name / aliases | 1ST Biotherapeutics, Inc. / 1STBIO / 주식회사 퍼스트바이오테라퓨틱스 | [3] |
| Country | Republic of Korea | [3] |
| Headquarters | Yongin-si, Gyeonggi-do, Republic of Korea | [3] |
| Website | https://www.1stbio.com/ | [3] |
| Company type / stage | Private, clinical-stage biopharmaceutical company | [2], [3] |
| Focus areas | Neurodegenerative diseases, oncology, rare diseases | [2] |
| Platform summary | 1ST-501 AI Drug Discovery Engine을 보유하며, 1ST-104 자료에서는 AI-driven in-house discovery를 활용해 671개 이상의 compound를 합성하고 multiple lead series를 도출했다고 설명. 다만 platform 자체의 quantitative superiority versus conventional discovery는 제시되지 않음. | [1], attachment |
| Financing / partnership signals | 2026-01 Series D 317억원 조달, 누적 투자금 약 1,080억원. MJFF LITE consortium 참여를 통한 LRRK2 연구 협력도 확인됨. | [2], [4] |
| Lead pipeline summary | Oncology 및 neurodegeneration에서 clinical/preclinical pipeline을 운영. 1ST-104는 공식 pipeline상 LRRK2/c-Abl → Parkinson's disease program으로 등재됨. | [1] |

1STBIO 공식 홈페이지는 Yongin 소재와 company identity를 확인하며, 공식 pipeline에는 1ST-104가 LRRK2/c-Abl을 표적하는 Parkinson's disease program으로 현재 등재되어 있습니다. :contentReference[oaicite:1]{index=1} 2026년 1월 회사는 317억원 Series D 및 누적 약 1,080억원의 투자 유치를 발표했습니다. :contentReference[oaicite:2]{index=2}

Attachment에서는 671 compounds를 합성하고 multiple lead series가 lead optimization 단계에서 진행되고 있다고 명시합니다. :contentReference[oaicite:3]{index=3}

---

## 2) Pipeline Snapshot

| Field | Content | Evidence |
|---|---|---|
| Company | 1ST Biotherapeutics, Inc. | [1], [3] |
| Lead asset | 1ST-104; representative optimized compounds include FB-3538A and FB-4853A. Final development candidate is not yet confirmed in reviewed evidence. | Attachment |
| Target | LRRK2 / c-Abl | [1], attachment |
| Theme / Cluster | **Theme: Neuroimmune / Cluster: Cytokine 신경조절** | Asset-specific iPSC-derived microglia target/ cytokine experiments + LRRK2 biology; internal SKBP mapping |
| MoA | Brain-penetrant dual LRRK2/c-Abl kinase inhibition. Lead series suppresses pRab10 and pCrkL while relatively preserving LRRK2 pS935, supporting a Type II-like LRRK2 pharmacology. Type II binding is structurally confirmed for c-Abl by co-crystal; LRRK2 structural confirmation was still planned. | Attachment, [5]-[8] |
| Modality / Platform | Small molecule | [1], attachment |
| Indication | Parkinson's disease | [1] |
| Stage | **Lead Optimization**. Official public pipeline uses broader “Discovery” labeling; the March 2026 attachment specifically states active lead optimization. Candidate nomination in 3Q 2026 was a plan, not a completed milestone. | [1], attachment |
| Key data | FB-4853A: LRRK2 biochemical IC50 11.12 nM; c-Abl IC50 0.93 nM; stimulated pRab10 IC50 12.41 nM; unstimulated pRab10 IC50 44.73 nM; pS935 IC50 >5,000 nM. Mouse PO F 62.08%, Kp,brain 0.91, Kp,uu,brain 0.31. hERG IC50 8.75 μM is a liability requiring follow-up. | Attachment |

공식 pipeline에서 1ST-104의 target/indication은 LRRK2/c-Abl 및 Parkinson's disease로 명확히 확인됩니다. :contentReference[oaicite:4]{index=4} 제공자료에서는 candidate selection을 향한 lead optimization이 진행 중이며 candidate nomination은 3Q 2026, Phase I initiation은 3Q 2027의 **계획**으로 표시되어 있어 이를 완료된 milestone으로 취급하지 않았습니다. :contentReference[oaicite:5]{index=5}

대표 compound FB-4853A는 LRRK2 11.12 nM 및 c-Abl 0.93 nM biochemical potency와 12.41 nM stimulated pRab10 potency를 보였습니다. :contentReference[oaicite:6]{index=6} :contentReference[oaicite:7]{index=7} Unstimulated A549 assay에서는 pRab10 IC50 44.73 nM인 반면 pS935 IC50가 >5,000 nM으로 나타나 Type II-like profile을 지지했습니다. :contentReference[oaicite:8]{index=8} :contentReference[oaicite:9]{index=9}

Mouse PK에서 FB-4853A는 5 mg/kg PO 기준 F 62.08%, Kp,brain 0.91, Kp,uu,brain 0.31을 보였습니다. :contentReference[oaicite:10]{index=10} 반면 hERG IC50는 8.75 μM으로, 자료 내 자체 기준상 10 μM 미만에 해당하여 development candidate 선정 시 exposure margin 확인이 중요한 safety diligence item입니다. :contentReference[oaicite:11]{index=11}

---

## 3) Scorecard Summary

| Criterion | Score (maximum 3 points each) | One-line judgment | Evidence used |
|---|---:|---|---|
| Target Relevance | **3점** | PD는 SKBP interest indication이며 LRRK2는 human genetics로 직접 연결되고, 1ST-104는 LRRK2/c-Abl을 실제 pharmacology로 조절함. | [1], [5]-[7], attachment |
| Competitive Landscape | **2점** | Type II-like/pS935-preserving profile이라는 quantitative differentiation은 있으나 NEU-411, BIIB122, BT-267 등 clinical LRRK2 competitors가 앞서 있으며 LUMA 및 c-Abl clinical failures가 존재. | [9]-[17], attachment |
| MoA Validity | **3점** | Asset-specific biochemical potency, pRab10/pCrkL cellular PD, pS935 conformational profile 및 c-Abl co-crystal로 직접 기능 검증. | Attachment, [7], [8] |
| Platform Attractiveness | **1점** | AI discovery platform과 반복 가능한 chemistry workflow는 확인되나 platform-vs-comparator quantitative advantage는 없음. | [1], attachment |
| Expansion Potential | **0점** | 1ST-104 자체의 PD 외 추가 active indication/program은 확인되지 않음. | [1], attachment |
| Data Maturity | **3점** | Biochemical/cellular pharmacology + selectivity/ADME/brain PK + microglia data 등 복수 quantitative domain이 존재. | Attachment |
| Marketability | **0점** | Asset-specific forecast가 없고, broad PD vs biomarker-selected PD label과 적절한 DMT price benchmark가 확정되지 않아 신뢰 가능한 A/B/C/D 계산을 수행하지 않음. | [10], [18] |
| **Total** | **12점** | Maximum total: 21점 → **REVIEW** | |

---

## 4) Criterion Detail Pages

### 4.1 Target Relevance
Score: **3점**

Main line: **Parkinson's disease는 SKBP의 핵심 interest indication이며, LRRK2는 human genetic causality가 가장 강한 PD target 중 하나이고 1ST-104는 LRRK2와 c-Abl을 동시에 실제 pharmacology로 조절합니다.**

What was checked:
- Target identity
- Disease/biology relevance
- SKBP Theme / Cluster fit
- General neurodegeneration / neuroinflammation / epilepsy relevance

Evidence trail:
- 공식 1STBIO pipeline: 1ST-104 = LRRK2/c-Abl, Parkinson's disease. [1] :contentReference[oaicite:12]{index=12}
- LRRK2 disease-segregating mutations were originally identified in autosomal-dominant Parkinsonism, providing direct human genetic linkage. [5] :contentReference[oaicite:13]{index=13}
- c-Abl has experimentally been linked to α-synuclein phosphorylation/degradation and PD-related neurodegeneration. [6] :contentReference[oaicite:14]{index=14}
- Attachment shows 1ST-104 compounds directly inhibit both LRRK2 and c-Abl and modulate their downstream biomarkers. :contentReference[oaicite:15]{index=15}

Investigation note:
- **3점 rule:** SKBP interest indication이 확인되고 target/MoA가 해당 disease biology에 직접 연결됨.
- PD와 LRRK2의 genetic linkage가 강하며 1ST-104 자체에서도 target modulation이 확인되어 3점.
- 3점이 최고점. 다만 dual-target에서 c-Abl contribution이 임상적으로 추가 benefit을 제공하는지는 아직 입증되지 않음.

### 4.2 Competitive Landscape
Score: **2점**

Main line: **1ST-104의 pS935-preserving Type II-like profile은 기존 Type I LRRK2 inhibition과 차별화 가능성이 있으나, clinical-stage LRRK2 경쟁이 이미 상당히 진행되었고 LRRK2 및 c-Abl monotherapy의 최근 efficacy failures가 진입장벽을 높였습니다.**

What was checked:
- Same disease competitors
- Same target competitors
- Same or similar MoA competitors
- Front runner count
- Approved / Phase 3 / clinical / preclinical status
- ClinicalTrials.gov, official company pipelines, recent primary clinical publications
- Type II LRRK2 competitors

Competitor table:

| Competitor | Company | Modality | Target / MoA | Stage | Why it matters | Source |
|---|---|---|---|---|---|---|
| NEU-411 | Neuron23 | Small molecule | Selective LRRK2 inhibitor | Phase 2, recruiting | Most advanced active precision-LRRK2 competitor; genotype-selected LRRK2-driven early PD | [9] |
| BIIB122 / DNL151 | Denali / Biogen | Small molecule | LRRK2 inhibitor | Phase 2a BEACON active in LRRK2-PD; idiopathic PD program discontinued | Direct target/modality comparator; Phase 2b LUMA failed primary/secondary endpoints in idiopathic PD | [10], [19] |
| BT-267 | Brenig Therapeutics | Small molecule | Brain-penetrant selective LRRK2 inhibitor | Phase 1 | Direct oral small-molecule LRRK2 competitor with CNS/selectivity positioning | [11] |
| FinsnoBio Type II LRRK2 program | FinsnoBio | Small molecule | Type II / G2019S-focused LRRK2 inhibition | Preclinical/IND-directed; exact asset stage undisclosed | Particularly relevant to 1ST-104's proposed Type II differentiation | [14] |
| ARV-102 | Arvinas | PROTAC | LRRK2 degradation | Phase 1 PD data | Different modality but clinically demonstrated CNS LRRK2 modulation; >50% CSF degradation reported | [12] |
| BIIB094 | Ionis/Biogen | Antisense oligonucleotide | LRRK2 lowering | Phase 1 completed | Clinical human validation of an alternative LRRK2-modulating modality | [13] |
| Vodobatinib | SPARC | Small molecule | c-Abl inhibitor | Phase 2 completed; negative | Shares c-Abl component of 1ST-104; trial did not show clinical benefit and had tolerability/dropout issues | [17] |

NEU-411 is currently in a randomized Phase 2 trial in genetically selected LRRK2-driven early PD. :contentReference[oaicite:16]{index=16} BIIB122's Phase 2b LUMA study in broader early PD failed its primary and secondary efficacy endpoints in May 2026; development in idiopathic PD was discontinued, although the LRRK2-variant BEACON Phase 2a remains active. :contentReference[oaicite:17]{index=17}

Additional clinical competition includes Brenig's BT-267 Phase 1 LRRK2 inhibitor and Arvinas' ARV-102, which reported ≥50% LRRK2 reduction in CSF in Phase 1 PD patients. :contentReference[oaicite:18]{index=18} FinsnoBio is independently developing Type II LRRK2 inhibitors, making the "Type II" concept itself non-exclusive competitively. :contentReference[oaicite:19]{index=19}

For c-Abl, the 2026 PROSEEK Phase 2 publication reported that vodobatinib did not demonstrate clinical benefit over placebo; this is relevant because c-Abl is the second pharmacologic component of 1ST-104. :contentReference[oaicite:20]{index=20}

Asset-specific differentiation:
- Internal DNL151 comparison showed DNL151 pRab10 IC50 46.14 nM and pS935 IC50 66.92 nM, whereas later 1ST-104 compound FB-4853A showed pRab10 IC50 44.73 nM with pS935 IC50 >5,000 nM. This supports substantially greater pS935 preservation at similar cellular pRab10 potency, consistent with Type II-like differentiation. :contentReference[oaicite:21]{index=21} :contentReference[oaicite:22]{index=22}
- However, this is company-generated preclinical comparison, not externally reproduced or clinical head-to-head evidence.

Investigation note:
- **2점 rule:** asset-specific quantitative differentiation versus an appropriate comparator or a credible differentiated entry space.
- pRab10/pS935 data provide this threshold.
- **Not 3:** multiple high-similarity clinical competitors are ahead; Type II LRRK2 is not unique; no human data or independent head-to-head evidence exists, and both broad LRRK2 inhibition and c-Abl inhibition have recent negative Phase 2 efficacy precedents.

### 4.3 MoA Validity
Score: **3점**

Main line: **1ST-104 compounds directly engage both intended kinase pathways and show mechanism-linked cellular PD biomarkers plus a conformationally differentiated LRRK2 profile.**

What was checked:
- Journal publication / PMID / DOI
- Mechanistic consistency
- Functional readout
- Disease linkage
- Safety-relevant signal

Evidence trail:
- FB-4853A biochemical LRRK2 IC50 11.12 nM, c-Abl IC50 0.93 nM. :contentReference[oaicite:23]{index=23} :contentReference[oaicite:24]{index=24}
- Cellular stimulated pRab10 IC50 12.41 nM and pCrkL IC50 0.67 nM. :contentReference[oaicite:25]{index=25} :contentReference[oaicite:26]{index=26}
- FB-4853A retains 79.9% pS935 level at its pRab10 IC50 and 63.9% at pRab10 IC80, greater preservation than FB-3538A, supporting Type II-like LRRK2 behavior. :contentReference[oaicite:27]{index=27}
- The deck explicitly summarizes potent pRab10 inhibition with preserved pS935 as a Type II-like binding profile. :contentReference[oaicite:28]{index=28}
- c-Abl Type II binding was directly demonstrated by X-ray co-crystal; **LRRK2 cryo-EM confirmation was still planned**, so structural confirmation should not be extended from c-Abl to LRRK2. :contentReference[oaicite:29]{index=29}
- Independent studies validate Rab10 phosphorylation as a direct LRRK2 kinase readout. [7] :contentReference[oaicite:30]{index=30}
- Independent primary work has characterized Type II inhibitors that stabilize an inactive/open LRRK2 kinase conformation. [8] :contentReference[oaicite:31]{index=31}

Investigation note:
- **3점 rule:** assessed-asset target engagement, mechanism-linked PD/biomarker or direct functional validation.
- 1ST-104 meets this through biochemical LRRK2/c-Abl inhibition and downstream pRab10/pCrkL cellular effects.
- 3점이 최고점. Remaining diligence is not MoA existence but whether the dual/Type II profile translates to superior in vivo efficacy and safety.

### 4.4 Platform Attractiveness
Score: **1점**

Main line: **Reusable AI/medicinal-chemistry discovery infrastructure exists, but its claimed advantage has not been quantitatively benchmarked against an appropriate discovery comparator.**

What was checked:
- Is the platform real and reproducible?
- Is differentiation supported by data?
- Is the underlying technical system reusable across candidates, programs, or conditions?

Evidence trail:
- Official pipeline identifies **1ST-501 AI Drug Discovery Engine** as a drug-engineering platform integrating medicinal chemistry and AI. [1] :contentReference[oaicite:32]{index=32}
- 1ST-104 attachment states that the AI-driven in-house platform contributed to synthesis of >671 compounds and identification of multiple lead series. :contentReference[oaicite:33]{index=33}
- 671-compound output demonstrates substantial use of the system but does not quantify whether AI improved hit rate, cycle time, potency, selectivity, cost, or candidate success versus a proper comparator.

Investigation note:
- **1점 rule:** reusable structure with plausible rationale but claim/concept-level differentiation.
- **Not 2:** no direct quantitative platform-vs-comparator experiment or metric was provided.
- The 1ST-104 potency/PK data are counted under Data Maturity and are not double-counted as platform superiority.

Platform vs Data Maturity separation:
- Platform Attractiveness = reusable discovery system.
- Data Maturity = 1ST-104 compound data.
- The 671-compound campaign establishes platform use but not a quantitative technical advantage.

### 4.5 Expansion Potential
Score: **0점**

Main line: **Reviewed official and company-supplied evidence confirms Parkinson's disease for 1ST-104 but does not confirm another active asset-specific indication.**

What was checked:
- Expansion beyond main indication
- Asset-specific quantitative data in additional indications
- Confirmed asset-specific preclinical, IND-enabling, or clinical development programs

Evidence trail:
- Official 1STBIO pipeline lists 1ST-104 only under Parkinson's disease. [1] :contentReference[oaicite:34]{index=34}
- The supplied 1ST-104 development timeline is directed toward PD models and future healthy-volunteer/PD clinical work. :contentReference[oaicite:35]{index=35}

Investigation note:
- **0점 rule:** no confirmed additional indication.
- **Not 1:** biological plausibility for other neurodegenerative indications is not enough; an additional indication explicitly tied to 1ST-104 was not verified.
- Other 1STBIO assets or historical c-Abl/LRRK2 programs are not treated as expansion of 1ST-104.

### 4.6 Data Maturity
Score: **3점**

Main line: **Lead-optimization stage에 적절한 quantitative evidence가 biochemical/cellular pharmacology, selectivity, ADME/PK/brain penetration 및 human iPSC-derived microglia 등 여러 독립적 development questions를 커버합니다.**

What was checked:
- In vitro data
- In vivo data
- Quantitative result
- Reproducibility
- IND-enabling / GLP tox / PK/PD / CMC / human data availability

Evidence trail:

**Domain 1 — Target pharmacology / cellular PD**
- FB-4853A LRRK2 11.12 nM, c-Abl 0.93 nM.
- Cellular pRab10 and pCrkL inhibition demonstrated.
- pRab10 reduction with relative pS935 preservation supports intended Type II-like profile.
:contentReference[oaicite:36]{index=36} :contentReference[oaicite:37]{index=37}

**Domain 2 — Selectivity**
- FB-4853A: PDGFRα >2,500 nM, KDR 3,797.8 nM, c-Kit >12,500 nM, LCK 4,314 nM, RIPK2 >5,000 nM.
- Residual liabilities include DYRK1A 144.1 nM and TRKB 511 nM, which should remain in the selectivity diligence package.
:contentReference[oaicite:38]{index=38} :contentReference[oaicite:39]{index=39}

**Domain 3 — PK / CNS exposure**
- FB-4853A 5 mg/kg PO: T1/2 1.37 h, Cmax 1,422.13 ng/mL, AUClast 2,301.69 h·ng/mL, F 62.08%, Kp,brain 0.91, Kp,uu,brain 0.31.
:contentReference[oaicite:40]{index=40}

**Domain 4 — Human iPSC-derived microglia**
- PFF/IFN-γ-stimulated healthy iPSC-derived microglia experiments evaluated LRRK2 pS935, Rab10 pT73 and cytokines TNF-α, IL-1β and IL-6 with FB-4853A.
- Cytokine reduction was described, but the deck explicitly states stimulation-condition optimization was still ongoing, so efficacy strength should not be overstated.
:contentReference[oaicite:41]{index=41} :contentReference[oaicite:42]{index=42}

**Safety / liability**
- FB-4853A hERG IC50 8.75 μM. :contentReference[oaicite:43]{index=43}
- A planned 7-day FB-4853 mouse lung toxicity study is shown, but the reviewed attachment contains the design rather than completed FB-4853 results. :contentReference[oaicite:44]{index=44}

Investigation note:
- **3점 rule:** at least two complementary quantitative evidence domains addressing different development questions, with at least one supporting program progression.
- 1ST-104 clearly exceeds this threshold.
- 3점이 최고점. Nevertheless, candidate nomination, completed in vivo efficacy/PK-PD, compound-specific repeat-dose lung tox and GLP tox are still required before development risk can be considered low.

### 4.7 Marketability
Score: **0점**

Main line: **Commercial potential cannot yet be translated into a reliable asset-specific peak-sales estimate without speculative assumptions.**

Assessment method: **insufficient_evidence**

Score basis type: **insufficient_evidence**

Calculation status: **not_performed**

Assessed global peak sales (million USD): **not assessed**

What was checked:
- Internal A/B/C/D calculation
- Reliable asset-specific external peak-sales forecast
- Competition haircut and pricing power
- Current PD epidemiology
- Likely broad versus biomarker-selected patient positioning after contemporary LRRK2 clinical results

Worksheet:

| Step | What to fill | Evidence / assumption |
|---|---|---|
| A. US TAP | Not performed | U.S. PD prevalence is large, but the clinically relevant 1ST-104 population is unresolved: broad idiopathic PD vs genetically/biomarker-selected LRRK2-driven PD. |
| B. US Unrisked Peak Sales | Not performed | No appropriate approved disease-modifying oral LRRK2/c-Abl benchmark price was identified. Using a symptomatic PD therapy would introduce an arbitrary benchmark. |
| C. US Obtainable Peak Sales | Not performed | Competition haircut cannot be reliably fixed before intended patient selection, differentiation and timing versus NEU-411/other LRRK2 approaches are established. |
| D. Global Obtainable Peak Sales | Not performed | C is unavailable; therefore the user-defined 1.5x multiplier is not applied. |
| External Peak Sales Reference | None verified | No reliable asset-specific 1ST-104 peak-sales forecast was found in reviewed public sources. |
| Final score basis | 0 | Neither a reliable internal calculation nor asset-specific external forecast exists. |

The Parkinson's Foundation reports a U.S. disease burden of roughly one million people living with PD and nearly 90,000 new diagnoses annually, confirming a large disease population. :contentReference[oaicite:45]{index=45} However, the May 2026 LUMA failure in broad early-stage PD and continued development of BIIB122 in genetically defined LRRK2-PD make **patient selection a central commercial variable**, rather than a detail that can be safely assumed. :contentReference[oaicite:46]{index=46}

Investigation note:
- Marketability is not scored from disease prevalence alone.
- No A/B/C/D calculation was forced because treatable subgroup, valid benchmark annualized net price and competition haircut would all require unsupported analyst assumptions.
- **Not 1:** no reliable global obtainable peak-sales estimate below or above USD 1,000 million can currently be established.

---

## 5) Validation Notes

Cross-checked facts:
- **Asset identity:** 1ST-104 is independently visible on 1STBIO's current official pipeline as LRRK2/c-Abl for Parkinson's disease and is also the subject of the supplied March 2026 development deck. [1] :contentReference[oaicite:47]{index=47} :contentReference[oaicite:48]{index=48}
- **Active program:** the public pipeline remains live, while the supplied deck documents active lead optimization and ongoing planned development work. :contentReference[oaicite:49]{index=49}
- **LRRK2 target validity:** human genetic evidence links pathogenic LRRK2 mutations directly to Parkinsonism, and multiple independent clinical programs remain directed at LRRK2. [5], [9], [10] :contentReference[oaicite:50]{index=50}
- **Competitive signal:** NEU-411 Phase 2 status is confirmed by ClinicalTrials.gov; BIIB122 LUMA failure and ongoing BEACON are confirmed by sponsor/registry sources. :contentReference[oaicite:51]{index=51}
- **Company status:** current official company pages and the 2026 Series D release support Republic of Korea domicile, Yongin HQ and ongoing financing/business activity. :contentReference[oaicite:52]{index=52}

Uncertain points:
- **Development candidate:** FB-3538A and FB-4853A are representative optimized compounds, but no reviewed source confirms which compound has been formally nominated as the 1ST-104 development candidate.
- **Stage milestone:** candidate nomination in 3Q 2026 was a forward-looking plan in the March deck. No public source reviewed as of 2026-08-18 confirms that nomination has actually occurred.
- **LRRK2 structural mode:** c-Abl Type II binding is confirmed by co-crystal, while direct LRRK2 Type II structural confirmation by cryo-EM was still planned. Do not equate the two.
- **In vivo efficacy:** the supplied deck contains planned in vivo biomarker/efficacy studies but not a completed 1ST-104 in vivo efficacy package sufficient to establish disease modification.
- **Lung safety:** the attachment demonstrates the MLi-2 positive-control lung phenotype and describes a planned FB-4853 comparison; completed FB-4853 repeat-dose lung histopathology is not present in the reviewed deck.
- **hERG:** FB-4853A IC50 8.75 μM requires exposure-margin assessment once the development candidate and projected human exposure are selected.
- **Patient-selection strategy:** broad idiopathic PD versus genetically/biomarker-defined LRRK2-driven PD is not established in the reviewed 1ST-104 materials. This is particularly important after the negative BIIB122 LUMA readout.
- **Commercial forecast:** no credible asset-specific peak-sales forecast was verified.

Search log:
- Official company page: checked [3]
- Pipeline page: checked [1]
- Platform page: checked platform section of [1]
- Publications: checked LRRK2 genetics, Rab10 biology, c-Abl/α-synuclein, Type II LRRK2 and c-Abl Phase 2 literature [5]-[8], [17]
- Regulatory / trial registry: NEU-411, BIIB122, BIIB094 [9], [13], [19]
- Competitor sources: Neuron23, Biogen/Denali, Brenig, Arvinas, Ionis/Biogen, FinsnoBio and vodobatinib [9]-[17], [19]
- Market / epidemiology sources: Parkinson's Foundation [18]; no asset-specific external sales forecast found
- Financing / partnership sources: 1STBIO Series D and MJFF LITE releases [2], [4]

---

## 6) Final Take

One-line summary:

**1ST-104는 PD target relevance와 preclinical pharmacology/brain PK가 강하고 pRab10 inhibition–pS935 preservation이라는 Type II-like differentiation이 매력적이지만, 아직 candidate nomination·in vivo efficacy·compound-specific repeat-dose safety가 완성되지 않았고, LRRK2/c-Abl 경쟁 및 최근 임상 실패를 감안하면 현재는 Shortlist보다는 Watch가 적절합니다.**

Recommendation:
- **Watch**

Most important diligence question:

**“최종 candidate에서 충분한 CNS target coverage를 확보하면서 FB-4853 계열의 hERG 및 LRRK2-related lung liability를 해소하고, BIIB122 LUMA와 c-Abl inhibitor Phase 2 failures를 넘어서는 in vivo efficacy/biomarker signal을 보여줄 수 있는가? 또한 개발 대상 환자를 broad idiopathic PD가 아닌 LRRK2-driven biomarker-selected population으로 정의할 것인가?”**

---

## References

Attachment source: **[104] Current Progress and Key Findings_NCDP.pdf, 1ST Biotherapeutics, March 2026.** :contentReference[oaicite:53]{index=53}

[1]: https://www.1stbio.com/rd-pipeline/ "1ST Biotherapeutics R&D Pipeline"
[2]: https://www.1stbio.com/wp-content/uploads/2025/04/1st-biotherapeutics-joins-the-michael-j-fox.pdf "1ST Biotherapeutics Joins the Michael J. Fox Foundation LITE Program"
[3]: https://www.1stbio.com/ "1ST Biotherapeutics official website"
[4]: https://www.1stbio.com/wp-content/uploads/2026/01/1STBIO_Series_D_completed.pdf "1STBIO Series D financing announcement"
[5]: https://pubmed.ncbi.nlm.nih.gov/15541309/ "Mutations in LRRK2 cause autosomal-dominant parkinsonism"
[6]: https://pubmed.ncbi.nlm.nih.gov/24412932/ "c-Abl phosphorylates alpha-synuclein and regulates its degradation"
[7]: https://pubmed.ncbi.nlm.nih.gov/27474410/ "Phos-tag analysis of Rab10 phosphorylation by LRRK2"
[8]: https://pubmed.ncbi.nlm.nih.gov/40465731/ "Type II kinase inhibitors that target Parkinson's disease-associated LRRK2"
[9]: https://clinicaltrials.gov/study/NCT06680830 "NEU-411 Phase 2 NEULARK"
[10]: https://investors.biogen.com/news-releases/news-release-details/biogen-and-denali-therapeutics-provide-update-phase-2b-luma "BIIB122 Phase 2b LUMA update"
[11]: https://www.brenigther.com/ "Brenig Therapeutics BT-267"
[12]: https://ir.arvinas.com/news-releases/news-release-details/arvinas-announces-positive-phase-1-data-arv-102-showing-greater/ "ARV-102 Phase 1 PD data"
[13]: https://www.nature.com/articles/s41591-026-04262-4 "LRRK2-targeting antisense oligonucleotide in Parkinson's disease"
[14]: https://www.finsnobio.com/pipeline "FinsnoBio LRRK2 Type II program"
[15]: https://neuron23.com/pipeline/ "Neuron23 NEU-411 pipeline"
[16]: https://clinicaltrials.gov/study/NCT03976349 "BIIB094 Phase 1 REASON study"
[17]: https://www.nature.com/articles/s41531-026-01275-1 "Vodobatinib Phase 2 PROSEEK study"
[18]: https://www.parkinson.org/understanding-parkinsons/statistics/prevalence-incidence "Parkinson's Foundation prevalence and incidence"
[19]: https://clinicaltrials.gov/study/NCT06602193 "BIIB122 Phase 2a BEACON study"
