# SKBP Fast Triage Result

> Version statement: This result was researched and scored with GPT instruction 1 — Fast Triage v3.3. Full Scout v3.4 has not been run. 제공된 triage status rule을 적용했습니다. :contentReference[oaicite:0]{index=0}

중요: 6개 자산 모두 현재 회사 R&D/pipeline 등재로 identity와 activity는 확인되지만, KINE-501B/C 및 KP-101은 적응증 fit이 낮고 KINE-501D/E 및 KP-102는 관심 적응증임에도 공개 asset-specific MoA/Data가 부족해 전부 REJECT로 처리합니다.

| # | Asset | Company | Target/MoA | Modality | Main indication | Stage | Country | TR | MOA | Data | Triage | Why | Source |
|---:|---|---|---|---|---|---|---|---:|---:|---:|---|---|---|
| 1 | KINE-501B | Kine Sciences | Microglial target cell; molecular target/MoA Unknown | Peptide | Frontotemporal dementia | Hit Discovery | Republic of Korea | 1 | 0 | 0 | REJECT | TR 1점: FTD는 신경퇴행성 질환이나 6개 관심 적응증 밖이다. MOA 0점: molecular target/MoA 미확인. Data 0점: 공개 정량 결과 미확인. | Kine Sciences pipeline; Synapse :contentReference[oaicite:1]{index=1} |
| 2 | KINE-501C | Kine Sciences | Microglial target cell; molecular target/MoA Unknown | Peptide | Unknown (LBD) | Hit Discovery | Republic of Korea | 1 | 0 | 0 | REJECT | TR 1점: LBD는 신경퇴행성 질환이나 6개 관심 적응증 밖이다. MOA 0점: molecular target/MoA 미확인. Data 0점: 공개 정량 결과 미확인. | Kine Sciences pipeline; Synapse :contentReference[oaicite:2]{index=2} |
| 3 | KINE-501D | Kine Sciences | Microglial target cell; molecular target/MoA Unknown | Peptide | Parkinson's disease | Preclinical unspecified | Republic of Korea | 2 | 0 | 0 | REJECT | TR 2점: Parkinson's disease는 관심 적응증이나 molecular target/MoA 미확인. MOA 0점. Data 0점: Preclinical 표기 외 공개 정량 결과 미확인. | Kine Sciences pipeline; Synapse :contentReference[oaicite:3]{index=3} |
| 4 | KINE-501E | Kine Sciences | Microglial target cell; molecular target/MoA Unknown | Unknown | Multiple sclerosis / neuroinflammatory disease | Preclinical unspecified | Republic of Korea | 2 | 0 | 0 | REJECT | TR 2점: multiple sclerosis는 관심 적응증이나 molecular target/MoA 미확인. MOA 0점. Data 0점: Preclinical 표기 외 공개 정량 결과 미확인. | Kine Sciences pipeline; Synapse :contentReference[oaicite:4]{index=4} |
| 5 | KP-101 | Korea Pharma Co Ltd | Unknown | Unknown | Major depressive disorder | Unknown | Republic of Korea | 0 | 0 | 0 | REJECT | TR 0점: major depressive disorder는 본 triage의 SKBP 관련 범위 밖이다. MOA 0점. Data 0점: 공식 R&D 등재 외 공개 정량 결과 미확인. | Korea Pharma Research Results :contentReference[oaicite:5]{index=5} |
| 6 | KP-102 | Korea Pharma Co Ltd | Unknown | Unknown | Alzheimer's disease | Unknown | Republic of Korea | 2 | 0 | 0 | REJECT | TR 2점: Alzheimer's dementia는 관심 적응증이나 molecular target/MoA 미확인. MOA 0점. Data 0점: 공식 R&D 등재 외 공개 정량 결과 미확인. | Korea Pharma Research Results :contentReference[oaicite:6]{index=6} |

## Notes
- KINE-501B/C의 Discovery는 Hit Discovery, KINE-501D/E의 generic Preclinical은 Preclinical unspecified로 정규화했습니다. :contentReference[oaicite:7]{index=7}
- KINE-501E는 asset-specific source가 generic “Chemical drugs”까지만 제시해 canonical modality는 Unknown입니다. :contentReference[oaicite:8]{index=8}
- KP-101/102는 공식 R&D 페이지 텍스트에서 정확한 current stage marker를 신뢰성 있게 판독할 수 없어 stage는 Unknown입니다. :contentReference[oaicite:9]{index=9}
