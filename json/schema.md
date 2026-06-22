# SKBP Pipeline Shortlist JSON Structure v3.1

`drug-valuation.schema.json` defines the v3.1 dashboard schema. The core change is that criterion-specific scoring, evidence type, and score judgment are separated.

## Top-Level Sections

- `meta`: Schema version, generated date, analyst role, output filename, `rubric_version`, and `rubric_author`.
- `input`: Company/asset inputs, source type, and notes.
- `source_report`: Human-readable GPT report used as the primary raw source for parser-driven extraction.
- `company_profile`: Basic company information, country, headquarters, website, focus areas, platform summary, financing/partnership signals, and official source URLs.
- `rubric`: The only place where scoring criteria and score definitions are stored.
- `json_summary`: Dashboard summary fields, including company country, target, theme, cluster, and target relevance score.
- `structured_table`: Core pipeline facts such as company, country, asset, target, theme, cluster, MOA, modality, indication, stage, key data, and sources.
- `hard_filter`: PASS / REVIEW / FAIL gate before final shortlisting.
- `scoring`: Seven criterion-level scores and asset-specific judgment results.
- `competitive_analysis`: Competitor table, similar pipeline counts, similar pipelines, and differentiation points.
- `validation`: Cross-checked facts, uncertainty, and source registry.
- `final_insight`: One-line conclusion, key strengths, and key risks.
- `obsidian`: Note metadata for Obsidian export.

## Rubric vs Scoring

Use this rule:

```text
rubric = how to score
scoring.criteria.* = why this asset received this score
```

Do not repeat rubric definitions inside scoring reasons.

## Hard Filter Rule

Use this rule for `hard_filter.status` and dashboard interpretation:

- `PASS`: `total_score >= 14`, `Target Relevance >= 3`, `MoA Validity >= 2`, `Data Maturity >= 2`, and no hard blocker.
- `REVIEW`: `total_score` is 9-13, or the score is high but stage / rights / asset identity / source uncertainty exists.
- `FAIL`: `total_score <= 8`, or `Target Relevance <= 1`, or no SKBP Theme / Cluster fit.

Each scoring criterion should contain:

- `score`: Integer from 0 to 3, or null if not scored.
- `evidence_type`: Audit label showing evidence level.
- `evidence_type_reason`: Why this evidence type was selected.
- `main_line_summary`: One-line explanation of why this asset received the score.
- `what_was_checked`: Checklist of reviewed evidence.
- `evidence_trail`: Key facts leading to the score.
- `evidence_sources`: Source-level evidence for the judgment.
- `investigation_note`: How the analyst/GPT investigated or interpreted the evidence.
- `why_not_higher`: Why the score was not one point higher.
- `uncertain_points`: Missing, weak, or conflicting evidence.

Allowed evidence types:

- `E0_not_found_or_not_assessable`
- `E1_company_claim_or_scientific_rationale_only`
- `E2_indirect_or_class_level_evidence`
- `E3_asset_specific_preclinical_or_technical_evidence`
- `E4_asset_specific_clinical_evidence`

`marketability` additionally contains:

```text
scoring.criteria.marketability.calculation
```

with A/B/C steps:

- `A_targetable_addressable_patient`: TAP estimate.
- `B_unrisked_peak_sales`: TAP x annual net price x peak penetration x treatment duration factor.
- `C_obtainable_peak_sales`: unrisked peak sales adjusted by competition, pricing power, and expansion capacity.

Marketability should use obtainable peak sales, not rNPV.

Marketability has a hard 0 gate. If `commercial_rationale_status` is `not_established`, then:

- `score` must be `0`.
- TAP, Unrisked Peak Sales, and Obtainable Peak Sales outputs must be `null`.
- `commercial_rationale_failure_reason` is required.

Marketability `main_line_summary` must explicitly mention all three steps:

```text
A. TAP: ...
B. Unrisked Peak Sales: ...
C. Obtainable Peak Sales: ...
```

Entry-order matrix should be used as a share/penetration reference. For example, in a 3-player market, a 1st entrant may be modeled around 50% share, a 2nd entrant around 30%, and a 3rd entrant around 20%.

## Rubric Version Management

Current rubric:

- `meta.rubric_version`: `1.0`
- `meta.rubric_author`: `kate`

When scoring criteria change:

1. Update `meta.rubric_version`.
2. Update the relevant definitions in `rubric`.
3. Keep prior JSON records unchanged unless they are intentionally rescored.
4. New or rescored assets should use the current rubric version.

## AI Champion Target Relevance

Theme and Cluster are sibling fields:

```text
json_summary.theme
json_summary.cluster
structured_table.theme
structured_table.cluster
```

When rendering text, combine them as:

```text
Theme: ___ (Cluster: ___)
```

Allowed Theme values:

- `E/I Balance`
- `Neuroimmune`
- `No Theme`
- `null`

SKBP focus clusters:

- `E/I Balance`: Ion Channel, Inhibitory Tone 강화, Synaptic Transmission, Chloride Homeostasis, Network Modulation
- `Neuroimmune`: CNS 손상 면역반응, 교세포 향상성, Cytokine 신경조절, 손상/질환 면역조절, 말초 면역기관 연결

## Seven Scoring Criteria

- `target_relevance`
- `competitive_landscape`
- `moa_validity`
- `platform_attractiveness`
- `expansion_potential`
- `data_maturity`
- `marketability`

Each criterion is scored from 0 to 3. Total score is 21.

## Competitive Analysis

Use `competitive_analysis.competitor_table` for the report-style competitor table:

- `competitor_name`
- `company`
- `modality`
- `target_or_moa`
- `development_stage`
- `relevance_to_asset`
- `source`

Use `similarity_summary` and `similar_pipelines` for deeper similarity analysis:

- total similar pipeline count
- high/medium/low similarity counts
- matched dimensions
- shared data points
- differentiating data points

## Files

- `drug-valuations.sample.json`: Example analysis object.
- `pipeline-records.json`: Local dashboard data source.
- `drug-valuation.schema.json`: Draft 2020-12 JSON Schema.
