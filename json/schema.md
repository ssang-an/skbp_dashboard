# SKBP Pipeline Shortlist JSON Structure — Fast Triage v3.2 / Full Scout v3.3

`drug-valuation.schema.json` defines the shared dashboard record contract. New Fast Triage records use `schema_version: "3.2"`, `instruction_version: "3.2"`, and `rubric_version: "3.2"`. Full Scout v3.3 does not change the Full Scout JSON shape, so its existing schema version remains unchanged while `instruction_version` and `rubric_version` advance to `3.3`.

## Top-Level Sections

- `meta`: Schema version, generated date, analyst role, output filename, `rubric_version`, and `rubric_author`. Also carries edit-provenance fields — see "Metadata Provenance" below.
- `input`: Company/asset inputs, source type, and notes.
- `source_report`: Human-readable GPT report used as the primary raw source for parser-driven extraction.
- `company_profile`: Basic company information, country, headquarters, website, focus areas, platform summary, financing/partnership signals, and official source URLs.
- `rubric`: The only place where scoring criteria and score definitions are stored.
- `json_summary`: Dashboard summary fields, including company country, target, theme, cluster, and target relevance score.
- `structured_table`: Core pipeline facts such as company, country, asset, target, theme, cluster, MOA, modality, indication, stage, key data, and sources.
- `hard_filter`: Full Scout uses PASS / REVIEW / FAIL. Fast Triage uses SELECT / REJECT / UNVERIFIED.
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
- `FAIL`: `total_score <= 8`, `Target Relevance <= 1`, or a confirmed hard blocker.

Lack of direct SKBP Theme / Cluster fit alone is not an automatic Full Scout FAIL condition.

## Fast Triage v3.2 Contract

Fast Triage uses three final status values only:

- `SELECT`: `identity_verified = true`, the asset is active, `Target Relevance >= 2`, and at least one of `MoA Validity >= 2` or `Data Maturity >= 2`.
- `REJECT`: asset identity is verified but SELECT criteria are not met, or a confirmed inactive/discontinued/terminated/withdrawn/suspended/dormant/clearly-failed blocker exists.
- `UNVERIFIED`: credible public sources do not establish the candidate as a specific biotech/pharma pipeline asset.

Unknown target, MoA, indication, or development stage does not by itself produce `UNVERIFIED`; write `Unknown` in the factual field and continue scoring. New v3.2 records must use the same status in `hard_filter.status`, `triage.status`, the Markdown result, and the recommendation mapping. Legacy records may retain historical values for read compatibility, but new saves and prompt output use the v3.2 vocabulary.

`triage.active_asset` is required: use `true` only for confirmed active status, `false` for confirmed inactivity, and `null` when current activity cannot be established. `SELECT` requires `true`; an identity-verified record with `null` cannot pass the SELECT gate.

The recommendation mapping is fixed: `SELECT` → `Run Full Scout`, `REJECT` → `Do not run Full Scout`, and `UNVERIFIED` → `Verify asset identity`.

Fast Triage evaluates only `target_relevance`, `moa_validity`, and `data_maturity`. If no aggregate score is used, both `scoring.total_score` and `scoring.max_score` are `null`. If an aggregate score is explicitly used, `max_score` is `9`.

Each Fast Triage criterion requires `evidence_basis`:

- `user_input_only`
- `public_source`
- `user_input_and_public_source`
- `no_supporting_basis`

Verified public source count is calculated from unique, actually verified public URLs. In the normal `evidence_sources` array, each counted item must be an object with an http(s) `source_url` and explicit `verified: true`; a bare or user-supplied URL does not count. An optional explicitly named `verified_evidence_sources` list may also be used as the authoritative verified list. Blank URLs, placeholder values, and a URL supplied but not opened/verified do not count.

Validation rules:

- Every current Fast Triage `main_line_summary` is non-empty and states the criterion's single selected score (for example, `TR 2점`); score ranges are invalid.
- `score >= 2` with `evidence_basis = no_supporting_basis` is invalid.
- `moa_validity.score >= 2` or `data_maturity.score >= 2` requires at least one verified public source URL.
- `public_source` and `user_input_and_public_source` require at least one verified public source URL.
- `user_input_only` must not introduce asset-specific target, MoA, cell type, or data absent from the user input.

## Shared Evidence Discipline

Both workflows use only asset-specific facts explicitly supplied by the user or verified from credible public sources. Confirmed facts may be canonicalized to approved dashboard values, but plans, expectations, financing, hiring, adjacent programs, class assumptions, and general scientific knowledge must not be converted into unconfirmed asset facts or completed/current milestones. General scientific knowledge is used only to map confirmed facts to the rubric. Unresolved or conflicting facts are recorded as `Unknown` with uncertainty.

## Canonical Development Stage

`structured_table.development_stage` uses exactly one of:

- `Hit Discovery`
- `Lead Optimization`
- `Preclinical Candidate`
- `IND-enabling`
- `Preclinical unspecified`
- `IND filed/cleared`
- `Phase 1`
- `Phase 1/2`
- `Phase 2`
- `Phase 2/3`
- `Phase 3`
- `Registration`
- `Approved / marketed`
- `Discontinued / inactive`
- `Unknown`

Only explicit stage wording or a completed/started milestone may be canonicalized. A planned or expected IND alone is not `IND-enabling`; use `Unknown` unless another current stage is confirmed. Plain `preclinical` maps to `Preclinical unspecified`, candidate nomination/selection maps to `Preclinical Candidate`, actual GLP toxicology/IND-directed CMC/IND-enabling work maps to `IND-enabling`, and submitted/filed/accepted/effective/cleared IND or CTA maps to `IND filed/cleared`. Trial recruitment/status text stays in source evidence or notes rather than being merged into this field.

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
- **Edit provenance** (when/who changed the GPT source report versus other dashboard activity): for every Full Scout record, `meta.last_edited_at` / `meta.last_edited_by` are derived from the newest exact `meta.edit_history[].field == "source_report.raw_markdown"` event whenever records are loaded or saved. This covers a real GPT source-report revision and a latest-rubric score recalculation only when that recalculation changed the report score table or rubric banner; a source label alone is never enough. Human or AI-assisted score overrides, qualitative reviews, focus-management fields, comments, attachments, and Full Scout AI `source_report.revision_note` events cannot change this visible timestamp. An AI Revision Note may be appended below the preserved report body, but it is classified as Team Review provenance rather than a GPT-original modification. `meta.edit_history` remains the append-only audit log of all dashboard activity (newest last, capped at 200 server-side). The detail page separates it into the GPT source/score timestamp and a scrollable `Team Review 변경 이력` containing all non-source events. SSO login isn't wired up yet, so `actor_ip` remains stored as a technical fallback; loopback addresses are displayed as `Local workspace`, while rubric events are displayed as their rubric version. Do not hand-write `edit_history` entries; they are stamped server-side from the request.
- **Rubric recalculation provenance**: the TAB2 row-level refresh action reapplies the latest Full Scout rubric's Total Score / Filter 2 rules to the seven stored criterion scores. It clears active manual criterion-score and manual Total Score overrides (so their red human-edit styling is removed), while preserving append-only manual history, explicit Filter 2 Human decisions/rationales, comments, and source evidence. The cleared values are snapshotted in `meta.rubric_recalculation.cleared_manual_scoring_overrides`; the same event is copied to `source_report.rubric_recalculation`, updates `meta.rubric_version`, synchronizes the GPT report's Scorecard rows and criterion-detail score labels from the official `scoring` values, and inserts a `Recalculated by Full Scout Rubric vX.Y` banner near the top of the raw GPT report. Only official rubric recalculation invokes this report-score synchronization: `meta.human_review.overrides` remains a display/audit layer and is never written into the GPT report. When the synchronized scores or banner change `source_report.raw_markdown`, the event is recorded as a GPT source-report edit and updates `meta.last_edited_at` / `meta.last_edited_by`.

## Detail Page Attachments and Qualitative Review

Three loosely-typed `meta` sub-objects support detail-page workflows that live outside the core scoring rubric:

- `meta.human_review`: Human direct edits use a non-destructive override layer. Criterion overrides live in `overrides.scores`, the effective sum in `overrides.total_score`, and the official `scoring` values remain unchanged until a successful rubric refresh or a confirmed GPT source reupload. `overrides.status_reason` stores the editable one-line rationale shown beside Review status. Status and rationale edits are separate audit events in both `meta.human_review.history` and `meta.edit_history`. The detail AI Agent is Q&A-only and cannot create score overrides or source-report revisions.
- `meta.focus_management`: focus/TAB3 review state for Full Scout records. OI Partnership v1.0 automatically stores `partnership_type` (`investment`, `value_up`, `joint_research`, `n_a`, or `unknown`), `partnership_note`, `partnership_evidence_sources`, classification source/status/version, and the latest auto suggestion. Target indication is checked first; Value Up applies only to Small Molecule with In Vivo O, In Vitro O, and ADMET >=25; investment applies to Non-Small Molecule at IND Enabling; joint research applies to Non-Small Molecule with Platform Attractiveness exactly 3 and wins an investment overlap. Missing required inputs produce `unknown`; non-target indications or complete-but-unmet rules produce `n_a`. Human classification/note edits take precedence until Auto is selected again. The same object also stores `owner_name`, `action_plan`, due date, and human-maintained `partner_material_flags`; explicit `partner_material_flag_overrides` take precedence over standalone CDP/NCDP/ADMET filename detection.
- `meta.focus_management` evidence triple: `in_vivo_status` / `in_vitro_status` (`O`/`X`/`N/A`) and `admet_completed` (0-50, denominator fixed at 50, `null` until an admet-named attachment exists) are auto-computed by `main.py` over `source_report.raw_markdown` plus extracted attachment text. `O` now requires explicit positive efficacy/activity wording, `X` requires explicit negative/failure wording, and a mere experiment mention with no clear outcome remains `N/A`. ADMET is the count of `Completed` occurrences in attachments whose filename contains `admet`. Each field remains human-overridable through its `_source: "manual"` sibling; changes immediately recalculate the latest OI auto suggestion without overwriting a human OI decision.
- `meta.human_review.overrides.total_score`: optional TAB2 Full Scout Total Score correction (0-21). It is independent from the seven criterion overrides, is audit-logged with reviewer ID, and receives the same refined red human-edit treatment. TAB3 displays this Tab2 Total Score as a read-only circular badge; legacy `meta.focus_management.total_score_override` values are retained in old records for compatibility but are no longer displayed or editable.
- Manual score/status/focus edits may store both `actor_name` (reviewer-entered name or employee ID) and `actor_ip`; the team workspace audit trail displays `actor_name` first and retains the IP as a fallback.
- `meta.attachments`: array of original source files (PPT/PPTX/PDF/TXT/Word/Excel) a company sent, uploaded from the detail page's Partner Materials dropzone. Each entry is `{id, filename, stored_path, content_type, size_bytes, uploaded_by, uploaded_at}`; files are stored on disk under `attachments/<record_id>/` (served via the `/attachments` static mount, gitignored — not committed to the JSON-as-source-of-truth data file) and only the metadata lives in the record. PDF is previewed in-browser, TXT and OpenXML PPTX/DOCX text can be shown in the report viewer, and unsupported binary formats remain downloadable. Managed by `POST` / `GET preview` / `DELETE /api/records/{id}/attachments...` in `main.py`.
- AI Agent Q&A is read-only and can use both `source_report.raw_markdown` and extracted `meta.attachments` text. Home chat sends the complete record-id scope from the active Tab and current filters; the backend selects question-relevant pipelines from that scope, then sends bounded excerpts from their GPT source reports and uploaded files to OpenRouter. Detail chat defaults to the current record only. Uploaded-file evidence is labeled by filename, and merely asking a question never changes the record or its review history.
- `meta.qualitative_review`: `{ criteria: { <criterion_id>: { entries: [...] } }, custom_criteria: [...] }`. `criteria` holds one entry list per qualitative-review criterion — both the 3 fixed criteria defined in `config/qualitative_review_criteria.md` and any per-record `custom_criteria` (each `{id, label, description, created_by, created_at}`, id prefixed `custom_`, registered via `POST /api/records/{id}/qualitative-review/criteria` and removed via the matching `DELETE .../criteria/{id}`, up to 10 per record) — separate from the seven scoring criteria below. `GET /api/records/{id}/qualitative-review/criteria/suggestions` groups matching custom criteria used by other records and excludes criteria already present on the current record; importing one creates a new local criterion with the same label/description and optional `imported_from_record_id` / `imported_from_criterion_id` provenance, without copying opinions. Each entry is `{id, author, body, is_ai, created_at}`. Human opinions are posted via `POST /api/records/{id}/qualitative-review` (`is_ai: false`). `POST /api/records/{id}/qualitative-review/ai-generate` calls OpenRouter to draft a first-pass opinion grounded only in `source_report.raw_markdown` and extracted `meta.attachments` text, and appends it as `{author: "AI", is_ai: true}`, rendered in the UI with an `[AI]` badge. Entries authored `"AI (초안)"` are an earlier rule-based placeholder mechanism (no OpenRouter call, since removed) kept in old records for data compatibility but filtered out of the UI.

## Rubric Version Management

Current Full Scout rubric definitions live in `config/scoring_criteria/v3_3_full.md` / `v3_3_display.md`, tracked by `main.py`'s `SCORING_CRITERIA_VERSION` constant (`3.3`). Fast Triage v3.2 is documented in `config/scoring_criteria/v3_2_triage.md` and tracked by `TRIAGE_CRITERIA_VERSION` (`3.2`). These are human-managed versioned files — there is no code path that generates or overwrites them automatically.

`meta.rubric_version` on a record is the version that was active when its GPT report/score was originally generated ("원본" — the original), and is never overwritten after the fact. `meta.rubric_author` defaults to `kate`.

When the SKBP team manually revises the rubric definitions:

1. Update `SCORING_CRITERIA_VERSION` (and add new `config/scoring_criteria/v3_x_*.md` files).
2. Keep prior JSON records unchanged unless they are intentionally rescored.
3. New or rescored assets should use the current rubric version.

### Detail-page "Score 기준 갱신" (single-record rubric refresh, v1)

`POST /api/records/{id}/refresh-rubric` (Full Scout records only) lets a reviewer ask OpenRouter to re-check whether *this one record's* GPT source report plus uploaded attachments contain clear, concrete evidence to update its official scores against the current rubric text (`SCORING_CRITERIA_FULL_MD`). A successful refresh writes the official `scoring.criteria` values, recalculates official Total Score and Filter 2, clears active Human criterion and Total Score overrides while retaining their history, and synchronizes the GPT report score table. The detail AI Agent is Q&A-only; it has no JSON/source apply endpoint. Rubric refresh does not overwrite the human-managed `config/scoring_criteria/*.md` files.

On success it stamps `meta.rescored_rubric_version` (computed via `next_minor_version`, chaining off the previous `rescored_rubric_version` if one exists, else off `meta.rubric_version` — e.g. `3.1 -> 3.2 -> 3.3`), `meta.rescored_at`, `meta.rescored_by`, and appends an entry to `meta.rubric_refresh_history`. The detail page then shows `원본 스코어링 지침 v{meta.rubric_version} · Score recalculated with rubric v{meta.rescored_rubric_version}`. If the LLM finds no clear evidence, sources conflict, the OpenRouter call fails, or `OPENROUTER_API_KEY` is unset, nothing is written — the record is byte-for-byte unchanged.

When a refresh succeeds, the official criterion and Total Score values are also synchronized into existing GPT Markdown Scorecard rows and criterion-detail score labels before the revision note is appended. This makes the `Recalculated` banner, structured `scoring`, and visible report scores agree. Human score/Total Score overrides never run this synchronization and remain visible only through the effective dashboard/detail score layer plus Team Review audit history.

### Confirmed GPT source reupload

During Data Upload review, records are matched within the same workflow by normalized company and asset names even when their dated `output_filename_base` values differ. The reviewer must explicitly choose whether to update the latest matching record or retain it and add the new investigation separately. A confirmed update keeps the existing record id and all Dashboard-managed metadata (`attachments`, collaboration, qualitative review, Human review history, and focus management), replaces the GPT source report and official structured/scoring data, clears active Human criterion/Total Score overrides, and records each cleared value against the new official score in Team Review history.

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
- `Others`: Target/MoA를 확인했지만 E/I Balance 또는 Neuroimmune에 해당하지 않는 경우
- `Unknown`: 공개자료가 부족해 Target/MoA 기반 Theme을 확정하지 못한 경우

새 조사에서는 `N/A`와 `No Theme`을 Theme/Cluster 분류에 사용하지 않습니다. E/I Balance·Neuroimmune에 속하지 않으면 Theme과 Cluster를 모두 `Others`로 기록합니다. 기존 레코드의 `N/A`·`No Theme`·미매핑 Cluster 값도 대시보드에서 `Others`로 정규화해 표시합니다. JSON Schema의 `No Theme` 허용값은 기존 레코드 호환성만을 위한 legacy 값입니다.

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
