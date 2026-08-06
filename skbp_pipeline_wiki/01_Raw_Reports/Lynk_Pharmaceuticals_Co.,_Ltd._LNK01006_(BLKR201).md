# SKBP Fast Triage Result

> Version statement: This result was researched and scored with GPT instruction 1 — Fast Triage v3.3. Full Scout v3.4 has not been run.

중요: 10개 중 ADEL-Y04, ILM01, LNK01006/BLKR201은 SELECT입니다. ILM21은 현재 Illimis 공식 파이프라인에서 신원이 확인되어 제공된 임시 UNVERIFIED 판정을 REJECT로 교정했으며, 나머지는 자산 identity 불명확 또는 SKBP fit·MoA·Data·활성 상태 부족으로 REJECT/UNVERIFIED 처리했습니다.

| # | Asset | Company | Target/MoA | Modality | Main indication | Stage | Country | TR | MOA | Data | Triage | Why | Source |
|---:|---|---|---|---|---|---|---|---:|---:|---:|---|---|---|
| 1 | ADEL-Y04 | ADEL | ApoE4-selective antibody | Antibody | Alzheimer's disease | Preclinical unspecified | Republic of Korea | 3 | 3 | 1 | SELECT | 활성 AD 전임상 자산이며 ApoE4 모델에서 기억·시냅스·tau 병리의 직접 기능성 효과가 확인됩니다. 정량 PK/PD 공개는 제한적입니다. | https://adelpharm.com/en/pipeline/<br>https://alz-journals.onlinelibrary.wiley.com/doi/10.1002/alz.088537 |
| 2 | Alzheimer's disease therapy, Beijing Youngen Biotechnology | Beijing Hotgen Biotech | Unknown | Unknown | Unknown | Unknown | China | 0 | 0 | 0 | UNVERIFIED | Youngen APP-siRNA와 Hotgen 투자계열 AA001이 혼합된 입력으로 어느 자산인지 특정할 수 없습니다. | https://www.youngenbiomed.com/youngen-biotechnology-patent-for-small-nucleic-acid-therapeutic-drugs-for-alzheimers-disease-granted.html<br>https://www.hotgen.com.cn/detail/683.html |
| 3 | Alzheimer's Disease | Beijing Youngen Biotechnology Co Ltd | Unknown | Unknown | Unknown | Unknown | China | 0 | 0 | 0 | UNVERIFIED | 질환명이 자산명으로 입력됐으며 Youngen의 독립 자산 코드와 매칭되지 않습니다. | https://www.youngenbiomed.com/youngen-biotechnology-patent-for-small-nucleic-acid-therapeutic-drugs-for-alzheimers-disease-granted.html |
| 4 | Drug to Inhibit Tau for Alzheimer's Disease | Hyper Corp Inc | Unknown | Unknown | Unknown | Unknown | Unknown | 0 | 0 | 0 | UNVERIFIED | 신뢰 가능한 공개자료에서 Hyper Corp의 discrete tau 자산을 확인하지 못했습니다. | No verified asset source |
| 5 | HBW-015 | Hyperway Pharmaceutical | Undisclosed nociceptive ion-channel inhibitor | Small molecule | Pain | Preclinical unspecified | China | 1 | 0 | 3 | REJECT | HBW-015-15에서 PK·급성/CCI 효능·selectivity·독성이 공개됐으나 generic Pain, 미공개 표적 및 현재 활동 미확인으로 REJECT입니다. | https://www.tianfulifesciencepark.com/News/Detail?id=2657 |
| 6 | ILM02 | Illimis Therapeutics | Tau/TAM GAIA fusion | Protein biologic | Unknown | Hit Discovery | Republic of Korea | 1 | 1 | 0 | REJECT | 활성 tauopathy 프로그램이나 적응증이 broad하고 ILM02 자산별 기능성 결과가 없습니다. | https://illimistx.com/en/sub/platform%26pipeline/pipeline.php<br>https://illimistx.com/en/sub/platform%26pipeline/platform.php |
| 7 | ILM21 | Illimis Therapeutics | Myelin debris/TAM GAIA fusion | Protein biologic | Multiple sclerosis / neuroinflammatory disease | Unknown | Republic of Korea | 3 | 1 | 0 | REJECT | 공식 파이프라인에서 MS·myelin debris 자산으로 확인되지만 회사 rationale 외 자산별 기능성·정량 데이터가 없습니다. | https://illimistx.com/en/sub/platform%26pipeline/pipeline.php<br>https://illimistx.com/en/sub/platform%26pipeline/platform.php |
| 8 | ILM01 | Illimis Therapeutics | Aβ/TAM GAIA fusion | Protein biologic | Alzheimer's disease | Preclinical unspecified | Republic of Korea | 3 | 3 | 1 | SELECT | 활성 AD lead이며 Aβ/TAM 기반 phagocytosis와 anti-inflammatory signaling의 prototype functional PoC가 확인됩니다. | https://illimistx.com/en/sub/platform%26pipeline/pipeline.php<br>https://illimistx.com/en/sub/platform%26pipeline/platform.php<br>https://alz-journals.onlinelibrary.wiley.com/doi/10.1002/alz.072368 |
| 9 | Neurodegenerative Diseases Lilly | Illimis Therapeutics Inc | Unknown | Unknown | Unknown | Unknown | Republic of Korea | 0 | 0 | 0 | UNVERIFIED | Illimis-Lilly 연구협력 descriptor이며 개별 asset name이 아닙니다. | https://www.illimistx.com/en/sub/investor%26media/news.php?bid=16&idx=282&mode=view&page=1 |
| 10 | LYNK01006 → LNK01006 (BLKR201) | Lynk Pharmaceuticals | TYK2 JH2 allosteric inhibitor | Small molecule | Multiple sclerosis / neuroinflammatory disease | Phase 1 | China | 3 | 2 | 1 | SELECT | CNS-penetrant TYK2 후보로 MS 모델 효능과 2026년 6월 Phase 1 첫 투여가 확인됩니다. 임상 결과는 아직 없습니다. | https://www.prnewswire.com/news-releases/lynk-pharmaceuticals-announces-fda-ind-approval-of-its-allosteric-tyk2-inhibitor-lnk01006-302629050.html<br>https://www.prnewswire.com/news-releases/lynk-pharmaceuticals-partner-formation-bio-doses-first-participant-in-phase-1-trial-of-blkr201-originally-designated-as-lnk01006-a-cns-penetrant-tyk2-inhibitor-302795362.html<br>https://clinicaltrials.gov/study/NCT07501039 |

## Notes
- #2와 #3은 Youngen의 무코드 APP-siRNA 프로그램과 관련될 수 있으나, 입력 자산명만으로 해당 프로그램을 자동 귀속하지 않았습니다.
- #5의 공개 데이터는 HBW-015 프로그램의 대표물질로 기재된 HBW-015-15에서 확인됐으며, 2026년 현재 active status는 확인되지 않았습니다.
- #7 ILM21은 Illimis 공식 파이프라인에 `Myelin Debris / Multiple Sclerosis / ILM21`로 등재되어 있어 identity_verified=true로 교정했습니다. 다만 stage와 자산별 결과는 미확인입니다.
- #8 ILM01은 prototype GAIA-Aβ 기능성 근거와 최종 ILM01 후보의 연속성을 Full Scout에서 확인해야 합니다.
- #10의 오기 `LYNK01006`은 `LNK01006`으로 정규화했으며, 2026년 6월부터 BLKR201 명칭으로 Phase 1이 진행 중입니다.
