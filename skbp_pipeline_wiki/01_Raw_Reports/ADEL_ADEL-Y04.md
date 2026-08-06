# SKBP Fast Triage Result

> Version statement: This result was researched and scored with GPT instruction 1 — Fast Triage v3.2. Full Scout v3.3 has not been run.

중요: 10개 후보 중 ADEL-Y04, ILM01, LNK01006은 SELECT, HBW-015와 ILM02는 REJECT, 나머지 5개는 특정 asset identity 미확인으로 UNVERIFIED입니다.

| # | Asset | Company | Target/MoA | Main indication | Stage | Country | TR | MOA | Data | Triage | Why | Source |
|---:|---|---|---|---|---|---|---:|---:|---:|---|---|---|
| 1 | ADEL-Y04 | ADEL | ApoE4 antibody | Alzheimer's disease | Preclinical unspecified | Republic of Korea | 3 | 3 | 1 | SELECT | Active AD program; direct mouse functional evidence, limited quantitative disclosure. | S1-S3 |
| 2 | Alzheimer's disease therapy, Beijing Youngen Biotechnology | Beijing Hotgen Biotech | Unknown | Unknown | Unknown | China | 0 | 0 | 0 | UNVERIFIED | Cannot map to Youngen APP-siRNA versus Hotgen AA001. | S1-S3 |
| 3 | Alzheimer's Disease | Beijing Youngen Biotechnology Co Ltd | Unknown | Unknown | Unknown | China | 0 | 0 | 0 | UNVERIFIED | Indication used as asset name. | S1-S2 |
| 4 | Drug to Inhibit Tau for Alzheimer's Disease | Hyper Corp Inc | Unknown | Alzheimer's disease | Unknown | Unknown | 0 | 0 | 0 | UNVERIFIED | No discrete Hyper Corp tau asset matched. | No verified asset source |
| 5 | HBW-015 | Hyperway Pharmaceutical | Undisclosed pathway inhibitor | Pain | Preclinical unspecified | China | 1 | 0 | 3 | REJECT | Strong data; generic pain fit, unnamed target and active status unconfirmed. | S1-S3 |
| 6 | ILM02 | Illimis Therapeutics | Tau/TAM GAIA fusion | Unknown (tauopathies) | Hit Discovery | Republic of Korea | 1 | 1 | 0 | REJECT | Active but broad, early and without disclosed result. | S1-S2 |
| 7 | ILM21 | Illimis Therapeutics | Unknown | Unknown | Unknown | Republic of Korea | 0 | 0 | 0 | UNVERIFIED | No public ILM21 asset. | S1 |
| 8 | ILM01 | Illimis Therapeutics | Aβ/TAM GAIA fusion | Alzheimer's disease | Preclinical unspecified | Republic of Korea | 3 | 3 | 1 | SELECT | Differentiated active AD lead; qualitative functional evidence. | S1-S3 |
| 9 | Neurodegenerative Diseases Lilly | Illimis Therapeutics Inc | Unknown | Unknown | Unknown | Republic of Korea | 0 | 0 | 0 | UNVERIFIED | Collaboration descriptor, not an asset. | S1 |
| 10 | LYNK01006 → LNK01006 | Lynk Pharmaceuticals | TYK2 allosteric inhibitor | Multiple sclerosis / neuroinflammatory disease | Phase 1 | China | 3 | 2 | 1 | SELECT | Active Phase 1 BLKR201 with CNS TYK2 rationale. | S1-S3 |

## Notes
- 입력 순서를 유지했으며, LYNK01006은 검증된 LNK01006/BLKR201로 철자 정규화했습니다.
- Youngen/Hotgen 및 Hyper tau의 설명형 행은 다른 공개 자산으로 임의 대체하지 않았습니다.
- 의심해볼 포인트: ADEL-Y04와 ILM01의 MOA 3은 공개된 직접 기능 결과에 기반하지만 정량 원자료가 제한적이므로 Full Scout에서 후보 동일성·통계·노출-반응을 우선 검증해야 합니다.
- 드릴다운 질문: HBW-015의 타깃·활성·신경병증성 통증 적응증이 공식 확인되면 triage가 바뀌는가? LNK01006의 환자 적응증이 MS로 확정되지 않으면 TR 3을 유지할 수 있는가?
- 업로드 지침 근거: :contentReference[oaicite:0]{index=0}

> 이 정보가 부정확할 수 있습니다.
