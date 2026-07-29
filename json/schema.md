# SKBP Pipeline Shortlist JSON Structure v3.1

`drug-valuation.schema.json` defines the v3.1 dashboard schema. The core change is that criterion-specific scoring, evidence type, and score judgment are separated.

## Top-Level Sections

- `meta`: Schema version, generated date, analyst role, output filename, `rubric_version`, and `rubric_author`. Also carries edit-provenance fields — see "Metadata Provenance" below.
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

## Metadata Provenance

Every record's `meta` carries two kinds of provenance:

- **Source provenance** (when/how the raw data was obtained): `meta.generated_at` is the date the GPT report/search underlying this record was produced. It is required by schema and, if a saved record omits it, `main.py`'s `ensure_meta_defaults` backfills it with today's UTC date on save. `meta.rubric_version` records which rubric/guideline version (full-scout `SCORING_CRITERIA_VERSION` or triage `TRIAGE_CRITERIA_VERSION`) was used to score it. Both are shown as a hover tooltip on dashboard table rows and in the detail-page metadata panel.
- **Edit provenance** (when/who made a manual change): `meta.last_edited_at` / `meta.last_edited_by` reflect the most recent human/dashboard edit, and `meta.edit_history` is an append-only log of such edits (newest last), each with `changed_at`, `actor_ip`, `source`, and the changed `field`. SSO login isn't wired up yet, so `actor_ip` (the requester's IP address) is a temporary stand-in for user identity — `main.py`'s `append_edit_history` helper stamps these on every mutating endpoint (`PUT /api/records/{id}`, the `manual-review` / `focus-management` / attachment / qualitative-review PATCH-or-POST endpoints, comment creation, and JSON-paste upserts). Do not hand-write `edit_history` entries; they are stamped server-side from the request.
- **Rubric recalculation provenance**: the TAB2 row-level refresh action reapplies the latest Full Scout rubric's Total Score / Filter 2 rules to the seven stored criterion scores without changing source evidence or human overrides. It stores the latest event in `meta.rubric_recalculation` and `source_report.rubric_recalculation`, updates `meta.rubric_version`, and inserts a `Recalculated by Full Scout Rubric vX.Y` banner near the top of the raw GPT report. This system recalculation intentionally does not append `meta.edit_history`.

## Detail Page Attachments and Qualitative Review

Three loosely-typed `meta` sub-objects support detail-page workflows that live outside the core scoring rubric:

- `meta.human_review`: manual score and decision overrides. `overrides.status_reason` stores the editable one-line rationale shown beside Review status. Status and rationale edits are separate audit events in both `meta.human_review.history` and `meta.edit_history`.
- `meta.focus_management`: focus/TAB3 review state for Full Scout records. OI Partnership v1.0 automatically stores `partnership_type` (`investment`, `value_up`, `joint_research`, `n_a`, or `unknown`), `partnership_note`, `partnership_evidence_sources`, classification source/status/version, and the latest auto suggestion. Target indication is checked first; Value Up applies only to Small Molecule with In Vivo O, In Vitro O, and ADMET >=25; investment applies to Non-Small Molecule at IND Enabling; joint research applies to Non-Small Molecule with Platform Attractiveness exactly 3 and wins an investment overlap. Missing required inputs produce `unknown`; non-target indications or complete-but-unmet rules produce `n_a`. Human classification/note edits take precedence until Auto is selected again. The same object also stores `owner_name`, `action_plan`, due date, and human-maintained `partner_material_flags`; explicit `partner_material_flag_overrides` take precedence over standalone CDP/NCDP/ADMET filename detection.
- `meta.focus_management` evidence triple: `in_vivo_status` / `in_vitro_status` (`O`/`X`/`N/A`) and `admet_completed` (0-50, denominator fixed at 50, `null` until an admet-named attachment exists) are auto-computed by `main.py` over `source_report.raw_markdown` plus extracted attachment text. `O` now requires explicit positive efficacy/activity wording, `X` requires explicit negative/failure wording, and a mere experiment mention with no clear outcome remains `N/A`. ADMET is the count of `Completed` occurrences in attachments whose filename contains `admet`. Each field remains human-overridable through its `_source: "manual"` sibling; changes immediately recalculate the latest OI auto suggestion without overwriting a human OI decision.
- `meta.human_review.overrides.total_score`: optional TAB2 Full Scout Total Score correction (0-21). It is independent from the seven criterion overrides, is audit-logged with reviewer ID, and receives the same refined red human-edit treatment. TAB3 displays this Tab2 Total Score as a read-only circular badge; legacy `meta.focus_management.total_score_override` values are retained in old records for compatibility but are no longer displayed or editable.
- Manual score/status/focus edits may store both `actor_name` (reviewer-entered name or employee ID) and `actor_ip`; the team workspace audit trail displays `actor_name` first and retains the IP as a fallback.
- `meta.attachments`: array of original source files (PPT/PPTX/PDF/TXT/Word/Excel) a company sent, uploaded from the detail page's Partner Materials dropzone. Each entry is `{id, filename, stored_path, content_type, size_bytes, uploaded_by, uploaded_at}`; files are stored on disk under `attachments/<record_id>/` (served via the `/attachments` static mount, gitignored — not committed to the JSON-as-source-of-truth data file) and only the metadata lives in the record. PDF is previewed in-browser, TXT and OpenXML PPTX/DOCX text can be shown in the report viewer, and unsupported binary formats remain downloadable. Managed by `POST` / `GET preview` / `DELETE /api/records/{id}/attachments...` in `main.py`.
- `meta.qualitative_review`: `{ criteria: { <criterion_id>: { entries: [...] } } }`, one entry list per fixed qualitative-review criterion (currently a temporary v1 set defined in `config/qualitative_review_criteria.md` — separate from the seven scoring criteria below). Each entry is `{id, author, body, is_ai, created_at}`. Submitting a human opinion via `POST /api/records/{id}/qualitative-review` immediately appends a second, rule-based placeholder entry with `is_ai: true` (no OpenRouter call) generated by `main.py`'s `build_placeholder_ai_comment`.

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
