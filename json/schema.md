# SKBP Pipeline Shortlist JSON Structure — Fast Triage v3.2 / Full Scout v3.3

`drug-valuation.schema.json` defines the persisted `dashboard_hybrid_v1` record. GPT Markdown remains the complete research/audit document. Persisted JSON is a compact display projection: dashboard columns, chart/filter inputs, scores, the small amount of criterion evidence needed by score hover/detail views, source/competitor graph links, the preserved Markdown, and dashboard-owned operational state. New Fast Triage records use instruction/rubric v3.2 and Full Scout records use v3.3.

## Dashboard GPT Response Ingestion

The primary paste format is one combined response: Markdown first, one `--- JSON DATA ---` line, then one complete JSON value. Strict JSON parsing runs first. Only after strict parsing fails, conservative `safePreprocessJson` repair may remove comments outside strings, escape raw control characters, preserve invalid literal backslashes, normalize external Unicode whitespace, convert `True`/`False`/`None`, quote simple ASCII object keys, or remove trailing commas. Duplicate keys, multiple roots, truncation, missing comma/colon, single-quoted strings, `NaN`/`Infinity`/`undefined`, excessive depth/size, and ambiguous repairs remain blocking errors. TAB1 requires a top-level Fast Triage array; TAB2 prefers one Full Scout object. Legacy two-fence, verbose, and Compact v1 input remains readable.

New GPT instructions emit `meta.ingestion_format: "compact_v2"`. GPT JSON contains the two `input` identity aliases used to join Fast Triage and Full Scout records, optional `input.user_context` copied from a user-provided meeting note or research request, identity/table fields, Theme/Cluster, filter/status fields, the 3 or 7 scores, concise criterion display fields, a canonical `validation.source_registry`, criterion `source_ids`, TAB1 diligence fields, and Full Scout competitor/similarity projections. Complete research narrative, methodology, and citation discussion remain in Markdown. `src/compact-ingestion.js` resolves source IDs for existing consumers, adds version/date/source-report boilerplate, and derives Total/maximum before validation. The save boundary writes `dashboard_hybrid_v1`, preserving `source_report.raw_markdown` plus operational `meta` such as attachments, notes, comments, human overrides, focus management, and audit/reupload history.

Compact numeric score/count strings are normalized only in known numeric fields; values containing units or commentary are not coerced. During UI ingestion, Compact v2 is projected onto the documented dashboard contract so unsupported extra keys are ignored before strict FastAPI validation; required score/identity fields and dangling or duplicate source IDs still block the save. Source IDs must be unique and resolve to the canonical registry. Home upload and Detail reupload call `/api/records/validate` before enabling save, and the save endpoint repeats validation. Legacy verbose, `compact_v1`, and the earlier persisted `dashboard_minimal_v1` shapes remain readable, including when mixed with hybrid records.

### LLM-assisted second-pass reparsing (manual, structural errors only)

When first-pass paste validation reports JSON syntax errors or missing required objects/keys, the paste panel's "AI 2차 파싱" button (manual, never automatic) calls `POST /api/records/llm-reparse` with the split Markdown, the best-effort JSON text, the active mode, and the current validation issues. The backend sends these to OpenRouter (`OPENROUTER_MODEL`, e.g. `deepseek/deepseek-v4-flash`) with a prompt that grounds every filled value strictly in the pasted Markdown: unresolved fields become `null` (or their documented default), and the model must not recompute or alter `scoring.total_score`, `hard_filter`/`triage` status, or `meta.*_version` fields — those stay server-derived. The response returns corrected `records` plus, per record index, a `corrected_fields` list of the dot-paths it filled in. The frontend re-validates the corrected JSON and, only at save time, stamps each affected record's `source_report.llm_reparse_fields` with that record's corrected-path list. `apply_llm_reparse_disclaimer` (`main.py`, run for every incoming record in `normalize_records`) then appends a small `> 이 정보가 부정확할 수 있습니다.` blockquote to the end of that record's `source_report.raw_markdown` whenever `llm_reparse_fields` is non-empty, so it renders wherever the GPT report Markdown is shown (detail page, report modal, exports) without any separate UI.

## Hybrid Persistence

Two deliberately large sections remain: `source_report.raw_markdown` is required to render/re-upload the GPT original and to support rubric refresh; dashboard-owned operational `meta` is required for team notes, attachments, manual overrides, audit history, TAB3, and Listing metadata. They are not duplicate GPT research fields and are not removed by compaction.

Every persisted criterion contains `score`, concise hover/detail fields (`evidence_type`, `evidence_type_reason`, `evidence_basis`, `main_line_summary`, `why_not_higher`, `investigation_note`, `uncertain_points`), and `source_ids`. Source objects are stored once in `validation.source_registry`; duplicated criterion-level `evidence_sources` are not persisted. Full evidence stays in Markdown. Marketability alone may retain its compact A/B/C/D display calculation. `hard_filter.hard_blocker` and `hard_filter.decision_uncertainty` remain so Filter 2 stays deterministic.

## Top-Level Sections

- `meta`: Record identity/version plus dashboard-owned operational state and audit provenance.
- `source_report`: Preserved GPT Markdown and parser status. Optional `llm_reparse_fields` (array of dot-paths) records which fields the manual AI 2차 파싱 pass filled in; see "LLM-assisted second-pass reparsing" above.
- `input`: Original company and asset aliases used only for cross-workflow dashboard grouping. Optional `user_context` preserves an appended user meeting note, hypothesis, internal observation, or research request; it is shown in Markdown as `Source: User input (not independently verified)`, can guide research, and is never treated as a verified public URL or stored in `validation.source_registry`.
- `company_profile`: Full Scout optional-column values only: headquarters, company stage, and platform summary.
- `json_summary`: Theme, Cluster, and the short description rendered by target cards/popovers.
- `structured_table`: Home/detail identity and grouping columns. New Compact v2 prompts keep `sources` empty; storage derives at most one primary source link from the canonical registry.
- `hard_filter`: Full Scout uses PASS / REVIEW / FAIL. Fast Triage uses SELECT / REJECT / UNVERIFIED.
- `scoring`: Three Fast Triage or seven Full Scout hybrid criterion projections plus stored Total/maximum.
- `competitive_analysis`: Full Scout density/counts plus the minimal competitor and similar-pipeline rows used by exports/graphs.
- `validation`: Decision uncertainty, cross-checked facts, and the canonical source registry.
- `final_insight`: One-line dashboard summary, recommendation, and most important diligence question.

## Rubric vs Scoring

Versioned files in `config/scoring_criteria/` define how to score. `scoring.criteria.*.score` stores the result, while the compact sibling fields support existing hover/detail views and graph export. The corresponding Markdown section remains authoritative for the complete reasoning. Do not copy the full report or rubric prose into JSON.

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

`triage.active_asset` is required: use `true` only for confirmed active status, `false` for confirmed inactivity, and `null` when current activity cannot be established. `SELECT` requires `true`; an identity-verified record with `null` cannot pass the SELECT gate. `triage.verified_public_source_count` retains the deduplicated count shown in the Quick Summary card while source details remain in Markdown.

The recommendation mapping is fixed: `SELECT` → `Run Full Scout`, `REJECT` → `Do not run Full Scout`, and `UNVERIFIED` → `Verify asset identity`.

Fast Triage evaluates only `target_relevance`, `moa_validity`, and `data_maturity`. Compact v2 derives their aggregate with `max_score: 9`. Migrated legacy records may retain historical null/maximum values so existing display semantics do not change.

The Fast Triage Markdown judgment identifies one evidence basis:

- `user_input_only`
- `public_source`
- `user_input_and_public_source`
- `no_supporting_basis`

Verified public source count is based on unique URLs that were actually opened and support the asset/claim. Complete citation/evidence discussion lives in Markdown. Compact v2 stores each source once in `validation.source_registry` and refers to it with criterion `source_ids`; persisted hybrid records do not duplicate the same object as criterion `evidence_sources`.

GPT Markdown quality rules (the Compact v2 JSON validator enforces the score/status structure, while these evidence checks remain visible in the report):

- Every Fast Triage Markdown judgment is non-empty and states one selected score (for example, `TR 2점`); score ranges are invalid.
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

Only explicit stage wording or a completed/started milestone may be canonicalized. A planned or expected IND alone is not `IND-enabling`; use `Unknown` unless another current stage is confirmed. Plain `preclinical` maps to `Preclinical unspecified`, candidate nomination/selection maps to `Preclinical Candidate`, actual GLP toxicology/IND-directed CMC/IND-enabling work maps to `IND-enabling`, and submitted/filed/accepted/effective/cleared IND or CTA maps to `IND filed/cleared`. For a multi-indication asset, the lead/currently most advanced confirmed stage is the single dashboard value; uncertainty limited to another indication does not erase that confirmed stage. Speculative `likely dormant` wording or a different historical alias marked discontinued does not establish the current asset as `Discontinued / inactive`. Trial recruitment, indication-specific status, historical identity detail, and uncertainty stay in source evidence or notes rather than being merged into this field.

## Canonical Modality

`structured_table.modality_platform` uses exactly one of `Small molecule`, `Peptide`, `RNA therapy`, `Cell therapy`, `Gene therapy`, `Antibody`, `Protein biologic`, `Other`, or `Unknown`. Route, dosage form, delivery, and platform qualifiers are removed from this filter-facing field: for example, `Oral small molecule`, `oral small-molecule / tablet`, and a qualified small-molecule discovery-platform phrase all map to `Small molecule`; `IV antibody` maps to `Antibody`; `topical peptide` maps to `Peptide`. The removed detail remains in the Markdown report, MoA, source evidence, platform summary, or notes.

New Compact v2 uploads are normalized to this vocabulary. The storage schema also accepts historical stage display text during one-time minimization so existing table cells are not silently rewritten; a later confirmed reupload or explicit record edit normalizes that value.

## Canonical Country, Main Indication, Theme, and Cluster

`structured_table.company_country` contains one legal-domicile/headquarters label. Operating regions and secondary offices remain in Markdown or notes. Known aliases use `config/category-synonyms.json`; for example, `China / United States operations` maps to `China` when China is the assessed company's stated domicile.

`structured_table.main_indication` is mandatory in new Compact v2 input and contains one dashboard disease bucket from the shared indication dictionary. Blank, null, omitted, `N/A`, and unnormalized values are not allowed. Lead selection prioritizes an official lead/primary/initial or sole current indication, then the indication belonging to the single most advanced confirmed active clinical program. When those sources cannot distinguish a lead but one or more canonical indications are confirmed, the first indication in the source's textual/listed order becomes the dashboard primary display; use `Unknown` only when no canonical indication is confirmed. `structured_table.indication` retains the complete disease wording and secondary indications. `structured_table.indication_list` is an optional derived array of every confirmed canonical indication in source order for display and multi-filtering. Filters use OR semantics: selecting any indication returns a pipeline that contains it. An explicit historical `Unknown` is therefore replaced only when the same record contains confirmed canonical indication evidence.

`json_summary.theme` is one of `E/I Balance`, `Neuroimmune`, `Protein Homeostasis`, `Others`, or `Unknown`. Theme mapping follows researched target/MoA evidence rather than disease association alone. `Protein Homeostasis` requires direct modulation of proteostasis, such as folding/chaperone, ubiquitin-proteasome, autophagy-lysosome, ER stress/UPR, or pathogenic aggregate-clearance biology; its cluster remains `Unknown` until a sub-cluster taxonomy is approved. A recognized cluster must belong to its configured Theme. Legacy `No Theme`, `No mapped SKBP cluster`, and `N/A` aliases close to `Others` or `Unknown` as appropriate instead of creating additional filter categories.

Each persisted scoring criterion has a `score` integer from 0 to 3 plus the concise hybrid display/source-reference fields listed above. The Markdown criterion section carries the complete checks, evidence trail, calculations, rationale, and limitations.

Allowed evidence types recorded in the Markdown report:

- `E0_not_found_or_not_assessable`
- `E1_company_claim_or_scientific_rationale_only`
- `E2_indirect_or_class_level_evidence`
- `E3_asset_specific_preclinical_or_technical_evidence`
- `E4_asset_specific_clinical_evidence`

Marketability research in Markdown contains the A/B/C/D steps:

- `A_targetable_addressable_patient`: TAP estimate.
- `B_unrisked_peak_sales`: TAP x annual net price x peak penetration x treatment duration factor.
- `C_obtainable_peak_sales`: unrisked peak sales adjusted by competition and pricing power.
- `D_global_obtainable_peak_sales`: completed US C multiplied by 1.5 exactly once.

Marketability should use assessed Global peak sales, not rNPV. A US external forecast is also normalized by 1.5; an already-Global forecast is unchanged.

Marketability has a hard 0 gate. If the Markdown assessment finds commercial rationale not established, then:

- `score` must be `0`.
- A/B/C/D outputs are not asserted.
- The Markdown must state the failure reason.

The Marketability Markdown section explicitly mentions all four steps when a calculation is used:

```text
A. US TAP: ...
B. US Unrisked Peak Sales: ...
C. US Obtainable Peak Sales: ...
D. Global Obtainable Peak Sales: C x 1.5 ...
```

Entry-order matrix should be used as a share/penetration reference. For example, in a 3-player market, a 1st entrant may be modeled around 50% share, a 2nd entrant around 30%, and a 3rd entrant around 20%.

## Metadata Provenance

Every record's `meta` carries two kinds of provenance:

- **Source provenance** (when/how the raw data was obtained): `meta.generated_at` is the date the GPT report/search underlying this record was produced. It is required by schema and, if a saved record omits it, `main.py`'s `ensure_meta_defaults` backfills it with today's UTC date on save. `meta.rubric_version` records which rubric/guideline version (full-scout `SCORING_CRITERIA_VERSION` or triage `TRIAGE_CRITERIA_VERSION`) was used to score it. Both are shown as a hover tooltip on dashboard table rows and in the detail-page metadata panel.
- **Edit provenance** (when/who changed the GPT source report versus other dashboard activity): for every Full Scout record, `meta.last_edited_at` / `meta.last_edited_by` are derived from the newest exact `meta.edit_history[].field == "source_report.raw_markdown"` event whenever records are loaded or saved. This visible timestamp therefore represents an actual GPT source-report replacement or explicit report edit; score-only rubric refreshes cannot change it. Human or AI-assisted score overrides, qualitative reviews, focus-management fields, comments, attachments, and Full Scout AI `source_report.revision_note` events also cannot change this visible timestamp. An AI Revision Note is classified as Team Review provenance rather than a GPT-original modification. `meta.edit_history` remains the append-only audit log of all dashboard activity (newest last, capped at 200 server-side). The detail page separates it into the GPT source/score timestamp and a scrollable `Team Review 변경 이력` containing all non-source events. SSO login isn't wired up yet, so `actor_ip` remains stored as a technical fallback; loopback addresses are displayed as `Local workspace`, while rubric events are displayed as their rubric version. Do not hand-write `edit_history` entries; they are stamped server-side from the request.
- **Rubric recalculation provenance**: TAB2's home-row refresh and detail-page Score refresh share the AI rubric-review endpoint for all seven Full Scout criteria. TAB1's row refresh uses the same guarded endpoint with the latest Fast Triage rubric and limits score changes to TR, MoA, and Data before recalculating SELECT/REJECT/UNVERIFIED. Each workflow evaluates the current asset against a bounded 24,000-character excerpt of its preserved GPT source report plus up to 16,000 characters of extractable uploaded attachment text. A criterion changes only when the model returns a valid, non-conflicting verdict with clear evidence; provider errors, malformed responses, or conflicts preserve the current record. Every valid, non-conflicting review records `meta.rubric_reviewed_version`, `meta.rubric_reviewed_at`, `meta.rubric_review_result`, and an entry in `meta.rubric_refresh_history`, even when no score changes. A successful score change additionally records `meta.rescored_*`, recalculates the workflow total and Filter 1 or Filter 2, clears active manual criterion/Total overrides while retaining their append-only history, and adds a `scoring` edit event. Rubric refresh never rewrites `source_report.raw_markdown`, its original score/status wording, or GPT-source modified provenance.

## Detail Page Attachments and Qualitative Review

Loosely-typed `meta` sub-objects support detail-page workflows that live outside the core scoring rubric:

- `meta.human_review`: Human direct edits use a non-destructive override layer. Criterion overrides live in `overrides.scores`, the effective sum in `overrides.total_score`, and the official `scoring` values remain unchanged until a successful rubric refresh or a confirmed GPT source reupload. `overrides.status_reason` stores the editable one-line rationale shown beside Review status. Status and rationale edits are separate audit events in both `meta.human_review.history` and `meta.edit_history`. The detail AI Agent is Q&A-only and cannot create score overrides or source-report revisions.
- `meta.focus_management`: focus/TAB3 review state for Full Scout records. `is_tracked: true` puts a pipeline in Shortlisting; its `tracking_status` is `priority` (yellow, active priority review; legacy tracked records default here) or `stationary` (strong gray, still shortlisted but monitoring because immediate introduction/partnership is blocked). The favorite control cycles `untracked → priority → stationary → untracked`, and each transition is audit-logged without changing the OI classification, score, or source report. OI Partnership v1.4 automatically stores `partnership_type` (`investment`, `value_up`, `joint_research`, `n_a`, or `unknown`), `partnership_note`, `partnership_evidence_sources`, classification source/status/version, and the latest auto suggestion. Target indication is checked first. Investment applies to Non-Small Molecule at `IND-enabling`, `IND filed/cleared`, or Phase 1 and later. Value Up applies only to Small Molecule with a confirmed pre-IND-enabling stage (`Hit Discovery`, `Lead Optimization`, `Preclinical Candidate`, or `Preclinical unspecified`), In Vivo O, In Vitro O, and an uploaded `ADMET` Partner Material with a numeric score (including 0); no ADMET score threshold applies. Full Scout and Partner Materials are used only when a needed structured value is absent; unknown evidence is never inferred. Joint research applies to every modality with Platform Attractiveness exactly 3 and takes priority when it overlaps another category. Missing required inputs produce `unknown`; non-target indications or complete-but-unmet rules produce `n_a`. Human classification/note edits take precedence until Auto is selected again. The same object also stores `owner_name`, `action_plan`, due date, and human-maintained `partner_material_flags`. Partner Material categories are `IR`, `CDP`, `NCDP`, `ADMET`, and `DD Report`; explicit `partner_material_flag_overrides` are retained for legacy manual flags, while an uploaded categorized file always marks its category as present.
- `meta.dashboard_uploaded_at`: immutable Dashboard receipt timestamp assigned to newly inserted Fast Triage or Full Scout records. Tab0 uses it to calculate workflow-level recent uploads; historical records without it use `meta.generated_at` as a legacy fallback. Shortlisting uses `meta.focus_management.added_at`, and the pending queue uses its own `added_at`.
- `meta.pipeline_metadata`: internal, non-scientific Listing metadata carried from Tab0 into the matching Fast Triage and Full Scout records. It is `{ listed_at, comment, comment_author, comment_source, comment_created_at, comment_updated_at, contact, contact_author, contact_source, contact_created_at, contact_updated_at, website, updated_at }`; `contact` is free text (name, email, phone, organization, role, contact date, or `O`). `website` retains only the first valid `http(s)` URL from the Listing spreadsheet cell and is a user-provided navigation hint, not research evidence. Exact `X` and hyphen-only (`-`, `–`, `—`) Contact values explicitly mean no contact history and clear any prior Contact value; a blank cell means no history only when no prior Contact exists, so a blank spreadsheet cell does not erase an existing note. Tab0 shows a non-clickable `-` for no-history state. Listing records that are not yet researched retain the same fields in `json/candidate-queue.json` until promotion. Bulk Listing imports save Comment as `Team Review` and display `일괄 Excel 업로드: Tab 0 · Listing Comment`; direct Listing Comment and Contact History Posts record their respective administrator, source, and timestamp, and can subsequently be edited or deleted only by that administrator. Blank spreadsheet cells never erase an existing Comment/Contact/Website; an explicit Tab0 edit may clear a field. These values are displayed in Fast Triage Quick Summary and Full Scout Team Review, are searchable/exportable from Tab0, and must never be copied into GPT source Markdown, evidence, scoring, or rubric decisions. Once a researched record exists, the Listing Comment is also represented as a durable source-attributed operational comment. Website is shared across the identity group, is registered or edited only in Tab0 Listing, and appears in Tab1/Tab2 as an external-link control that opens the shared URL. Tab0's Comment and Contact popovers are derived operational feeds: Contact-labelled human-authored Tab1/Tab2 entries appear only in Contact, while the remaining human-authored Final Comments, Fast Triage criterion notes, and direct Team Review comments appear in Comment. AI-generated qualitative answers and imported duplicates remain excluded.
- `meta.collaboration`: Team Review Workspace comment thread. Normal comments retain their author and reply relation. A Contact History post uses `category: "contact_history"`; a Fast Triage Final Comment post uses `category: "final_comment"`. Both retain their own author and timestamps, can be independently edited or deleted by their author, and are separate from general comments. Contact History appears in Tab0 Contact only; Final Comments appear in Tab0 Comment. System-imported cross-workflow comments have `{system_import: true, import_key, source}`: Fast Triage Final Comment and Fast Triage criterion notes are copied once to matching Full Scout records with source-labelled authors, while Listing comments retain the saved Listing author (`Team Review` for bulk imports, or the administrator for a direct Listing Comment Post) on researched records. `deleted_import_keys` prevents an administrator-deleted imported comment from returning on a later reupload. These comments are operational review context only and never enter GPT source Markdown, evidence, scoring, or rubric decisions.
- `json/candidate-queue.json.listing_details`: Tab0-only optional retrieval context for a still-pending Listing entry: `{ country, modality, target, main_indication, stage, website }`. It is shown and exported in the Tab0 progress table and may be appended to the Fast Triage prompt only as user-provided identification context. Website accepts one `http(s)` URL and renders as an external-link pill. Administrators may correct the pending Listing row inline; `manual_fields` retains the corrected field, editor, and timestamp solely to provide a subtle manual-edit cue. Excel headers are matched by meaning (for example `HQ Location → Country`); repeated operational-note headers such as `Comment`, `Priority`, `Reason for Priority`, and `Next Step` concatenate into Comment, while `Meeting History`/`Contact History` concatenate into Contact. When the same Listing identity is uploaded again, blank fields are filled from the new row; conflicting values are replaced only when the new row has more populated Listing fields, otherwise the existing value is retained. Non-empty reimported Listing Comments append as a new line unless they duplicate an existing comment block. It is independently verified by research and is deliberately not promoted into `pipeline-records.json`, so it cannot overwrite official Fast Triage/Full Scout fields, evidence, scoring, or rubric decisions. While an entry is pending, Tab0 displays these Listing values. Once an identity has a researched record, Tab0 displays official fields with `Full Scout → Fast Triage` precedence; field-level blanks in Full Scout retain a non-blank Fast Triage value. This is a read-only display replacement, not a write-back to the Listing entry; edits must then be made in Tab1 or Tab2.
- `meta.focus_management` evidence triple: `in_vivo_status` / `in_vitro_status` (`O`/`X`/`N/A`) and `admet_completed` (0-25, denominator fixed at 25, `null` until an ADMET attachment exists) are auto-computed by `main.py`. In Vivo/In Vitro use Full Scout and non-ADMET Partner Materials; `O` requires an explicit positive efficacy/activity wording, `X` requires explicit negative/failure wording, and a mere experiment mention with no clear outcome remains `N/A`. ADMET uses only ADMET Partner Materials: it matches the Study and its Status, counts completed canonical standard studies once, and always displays `completed / 25`. Exact Status `Y`, case-insensitive `Complete`/`Completed`, and Korean completion expressions containing `완료` count, unless an explicit negative/pending expression takes precedence. Optional studies such as Dog Telemetry are excluded from both numerator and denominator. When Study–Status text is available, this deterministic count takes precedence over a document-model ADMET count. Each field remains human-overridable through its `_source: "manual"` sibling; changes immediately recalculate the latest OI auto suggestion without overwriting a human OI decision.
- `meta.human_review.overrides.total_score`: optional TAB2 Full Scout Total Score correction (0-21). It is independent from the seven criterion overrides, is audit-logged with reviewer ID, and receives the same refined red human-edit treatment. TAB3 displays this Tab2 Total Score as a read-only circular badge; legacy `meta.focus_management.total_score_override` values are retained in old records for compatibility but are no longer displayed or editable.
- Manual score/status/focus edits may store both `actor_name` (reviewer-entered name or employee ID) and `actor_ip`; the team workspace audit trail displays `actor_name` first and retains the IP as a fallback.
- `meta.attachments`: array of original source files (PPT/PPTX/PDF/TXT/Word/Excel) a company sent, uploaded from the detail page's Partner Materials dropzone. Each entry is `{id, filename, stored_path, content_type, size_bytes, uploaded_by, uploaded_at}`; files are stored on disk under `attachments/<record_id>/` (served via the `/attachments` static mount, gitignored — not committed to the JSON-as-source-of-truth data file) and only the metadata lives in the record. PDF is previewed in-browser, TXT and OpenXML PPTX/DOCX text can be shown in the report viewer, and unsupported binary formats remain downloadable. Managed by `POST` / `GET preview` / `DELETE /api/records/{id}/attachments...` in `main.py`.
- `meta.topic_notes`: array of inline Team Review notes that remain separate from `source_report.raw_markdown`. Each note is `{id, topic_id, topic_key, topic_title, body, author_id, author_name, created_at, updated_at}`. `topic_id` maps to a rendered report heading; `topic_key` removes section numbering and normalizes the heading so a note can remap after a same-asset Full Scout reupload. Notes that no longer match any heading remain visible in an unmatched-notes panel instead of being discarded. Confirmed reupload preserves this array through `preserve_dashboard_meta`; note create/update/delete operations are authenticated and audit-logged.
- `meta.report_reupload_history`: up to 10 recoverable pre-reupload revisions. A confirmed same-asset reupload that changes `source_report.raw_markdown` stores the previous source report and a deep record snapshot before replacement. Nested reupload history is removed from each snapshot to prevent recursive growth; Topic notes and operational metadata continue independently on the live record.
- AI Agent Q&A is read-only and can use both `source_report.raw_markdown` and extracted `meta.attachments` text. Home chat sends the complete record-id scope from the active Tab and current filters; the backend selects question-relevant pipelines from that scope, then sends bounded excerpts from their GPT source reports and uploaded files to OpenRouter. Detail chat defaults to the current record only. Uploaded-file evidence is labeled by filename, and merely asking a question never changes the record or its review history.
- `meta.qualitative_review`: `{ criteria: { <criterion_id>: { entries: [...] } }, custom_criteria: [...] }`. `criteria` holds one entry list per qualitative-review criterion — both the 3 fixed criteria defined in `config/qualitative_review_criteria.md` and any per-record `custom_criteria` (each `{id, label, description, created_by, created_at}`, id prefixed `custom_`, registered via `POST /api/records/{id}/qualitative-review/criteria` and removed via the matching `DELETE .../criteria/{id}`, up to 10 per record) — separate from the seven scoring criteria below. `GET /api/records/{id}/qualitative-review/criteria/suggestions` groups matching custom criteria used by other records and excludes criteria already present on the current record; importing one creates a new local criterion with the same label/description and optional `imported_from_record_id` / `imported_from_criterion_id` provenance, without copying opinions. Each entry is `{id, author, body, is_ai, created_at}`. Human opinions are posted via `POST /api/records/{id}/qualitative-review` (`is_ai: false`). `POST /api/records/{id}/qualitative-review/ai-generate` calls OpenRouter to draft a first-pass opinion grounded only in `source_report.raw_markdown` and extracted `meta.attachments` text, and appends it as `{author: "AI", is_ai: true}`, rendered in the UI with an `[AI]` badge. Entries authored `"AI (초안)"` are an earlier rule-based placeholder mechanism (no OpenRouter call, since removed) kept in old records for data compatibility but filtered out of the UI.

## Rubric Version Management

`config/rubric-release.json` is the canonical release manifest for the active Fast Triage and Full Scout workflow versions, schema versions, rubric/display file paths, storage contract, and deterministic calculation constants such as the Marketability Global multiplier. `main.py` loads its version constants and rubric paths from this file and refuses to start when required manifest entries or files are missing. Current Full Scout definitions live in the files declared by the manifest (`v3_3_full.md` / `v3_3_display.md`), while Fast Triage uses the declared `v3_2_triage.md`. The release consistency test also checks that the copied GPT guidance and visible frontend version labels match the manifest.

The manifest coordinates a release; it does not infer scoring code from edited prose. A research-only wording change can remain within an instruction file. Any change that can alter a criterion score must update the relevant rubric file and release version, while structural fields or deterministic formulas additionally require the compact contract, schema/parser/storage/render surfaces, and regression tests to change in the same release.

`meta.rubric_version` on a record is the version that was active when its GPT report/score was originally generated ("원본" — the original), and is never overwritten after the fact. `meta.rescored_rubric_version` identifies the latest rubric that actually changed official scores; `meta.rubric_reviewed_version` identifies the latest successfully checked rubric even when no score changed. Prompt-only author/language/output-format boilerplate is not persisted.

When the SKBP team manually revises the rubric definitions:

1. Add the new versioned files under `config/scoring_criteria/` and update the corresponding workflow entry in `config/rubric-release.json`.
2. Keep prior JSON records unchanged unless they are intentionally rescored.
3. New or rescored assets should use the current rubric version.

### Detail-page "Score 기준 갱신" (single-record rubric refresh, v1)

`POST /api/records/{id}/refresh-rubric` lets a reviewer ask OpenRouter to re-check one record's preserved GPT source report plus uploaded attachments against the current workflow rubric. Full Scout reviews seven criteria and recalculates Total/Filter 2 when scores change; Fast Triage reviews TR/MoA/Data and recalculates Total/Filter 1. The detail AI Agent is Q&A-only; it has no JSON/source apply endpoint. Rubric refresh does not overwrite the human-managed `config/scoring_criteria/*.md` files.

Every valid, non-conflicting review stamps `meta.rubric_reviewed_version`, `meta.rubric_reviewed_at`, `meta.rubric_reviewed_by`, and `meta.rubric_review_result`. When official scores actually change it also stamps `meta.rescored_rubric_version`, `meta.rescored_at`, and `meta.rescored_by`; the original `meta.rubric_version` remains unchanged. Fast Triage Quick scan shows `Recalculated at` / `Rubric used to recalculate` after an actual score change, or `Latest rubric reviewed at` / `Rubric used for review` when the latest rubric was checked without a score change. Source conflicts, malformed responses, OpenRouter failures, and missing API keys write no successful-review metadata.

When a refresh succeeds, the official criterion and Total Score values are also synchronized into existing GPT Markdown Scorecard rows and criterion-detail score labels before the revision note is appended. This makes the `Recalculated` banner, structured `scoring`, and visible report scores agree. Human score/Total Score overrides never run this synchronization and remain visible only through the effective dashboard/detail score layer plus Team Review audit history.

### Confirmed GPT source reupload

During Data Upload review, records are matched within the same workflow by normalized company and asset names even when their dated `output_filename_base` values differ. The reviewer must explicitly choose whether to update the latest matching record or retain it and add the new investigation separately. A confirmed update keeps the existing record id and all Dashboard-managed metadata (`attachments`, collaboration, qualitative review, Human review history, and focus management), replaces the GPT source report and official structured/scoring data, clears active Human criterion/Total Score overrides, and records each cleared value against the new official score in Team Review history.

## AI Champion Target Relevance

Theme and Cluster are sibling fields:

```text
json_summary.theme
json_summary.cluster
```

When rendering text, combine them as:

```text
Theme: ___ (Cluster: ___)
```

Allowed Theme values:

- `E/I Balance`
- `Neuroimmune`
- `Protein Homeostasis`
- `Others`: Target/MoA를 확인했지만 E/I Balance, Neuroimmune 또는 Protein Homeostasis에 해당하지 않는 경우
- `Unknown`: 공개자료가 부족해 Target/MoA 기반 Theme을 확정하지 못한 경우

새 조사에서는 `N/A`와 `No Theme`을 Theme/Cluster 분류에 사용하지 않습니다. 세 R&D Theme에 속하지 않으면 Theme과 Cluster를 모두 `Others`로 기록합니다. Protein Homeostasis는 승인된 하위 Cluster가 아직 없으므로 Cluster를 `Unknown`으로 기록합니다. 기존 레코드의 `N/A`·`No Theme`·미매핑 Cluster 값도 대시보드에서 `Others` 또는 `Unknown`으로 정규화해 표시합니다. JSON Schema의 `No Theme` 허용값은 기존 레코드 호환성만을 위한 legacy 값입니다.

SKBP focus clusters:

- `E/I Balance`: Ion Channel, Inhibitory Tone 강화, Synaptic Transmission, Chloride Homeostasis, Network Modulation
- `Neuroimmune`: CNS 손상 면역반응, 교세포 향상성, Cytokine 신경조절, 손상/질환 면역조절, 말초 면역기관 연결
- `Protein Homeostasis`: `Unknown` (하위 Cluster taxonomy 승인 전)

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

Persist only `competitive_analysis.competitive_density` and
`competitive_analysis.similarity_summary`'s total/high/medium/low counts because
those values feed dashboard columns and visuals. The report-style competitor table,
matched dimensions, shared/differentiating data, search scope, and sources belong in
the preserved Markdown report and are not duplicated in JSON.

## Files

- `drug-valuations.sample.json`: Example analysis object.
- `pipeline-records.json`: Local dashboard data source.
- `drug-valuation.schema.json`: Draft 2020-12 JSON Schema.
