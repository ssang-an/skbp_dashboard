# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

A FastAPI + vanilla-JS dashboard for tracking and scoring preclinical drug pipeline candidates (SKBP = a CNS-focused sourcing rubric covering "E/I Balance" and "Neuroimmune" themes). GPT-generated due-diligence reports are pasted in as JSON, scored against a versioned rubric, and exported to Obsidian-compatible Markdown vaults for graph-based review. Most UI text and rubric content is Korean.

## Commands

Install and run (PowerShell, Windows-only environment):

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Open `http://127.0.0.1:8000`. There is no build step, bundler, package.json, linter, or test suite in this repo — `src/` JS/CSS is served as-is via FastAPI's `StaticFiles`.

Regenerate Obsidian exports from the JSON source of truth (also triggerable via API):

```powershell
.\.venv\Scripts\python.exe .\scripts\export_obsidian.py       # writes obsidian/
.\.venv\Scripts\python.exe .\scripts\export_pipeline_wiki.py  # writes skbp_pipeline_wiki/
```

Deploys as a Python web service (Render/Railway/Fly.io); see `Procfile` / `render.yaml`. `uvicorn main:app --host 0.0.0.0 --port $PORT` is the start command. Data persists only in the local `json/pipeline-records.json` file — no database — so free-tier hosting loses data on redeploy.

## Architecture

### Single source of truth

`json/pipeline-records.json` is a flat array of analysis records and is the *only* persisted data store. Everything else (Obsidian vault, pipeline wiki vault, dashboard views) is a derived, regenerable artifact of this file. When changing record shape, update `json/drug-valuation.schema.json` (JSON Schema draft 2020-12) and `json/schema.md` (human-readable structure/rubric doc) together — `schema.md` is the authoritative explanation of section semantics (`meta`, `input`, `source_report`, `company_profile`, `rubric`, `json_summary`, `structured_table`, `hard_filter`, `scoring`, `competitive_analysis`, `validation`, `final_insight`, `obsidian`).

### Two record workflows sharing one schema

Records are either **full scout** reports or **fast triage** reports (`main.py`'s `is_fast_triage_record`, detected via `meta.review_type`, `source_report.parser_status/source_format`, or presence of a `triage` key). The two workflows use different rubric versions (`SCORING_CRITERIA_VERSION` = full, `TRIAGE_CRITERIA_VERSION` = triage) tracked independently in `config/scoring_criteria/v3_1_*.md` and `v3_2_*.md`. AI-assisted revisions bump `meta.rubric_version` differently depending on which workflow a record belongs to (`prepare_revision_context`, `next_minor_version` vs `next_triage_revision_version`).

### Scoring model

Seven fixed criteria (`CRITERION_IDS` in `main.py`, mirrored in `RULE_PREFIXES`): `target_relevance`, `competitive_landscape`, `moa_validity`, `platform_attractiveness`, `expansion_potential`, `data_maturity`, `marketability`. Each is scored 0-3 (`SCORE_ALLOWED_VALUES`), total out of 21, plus an `evidence_type` audit label (`EVIDENCE_TYPE_ALLOWED_VALUES`, E0-E4). `hard_filter.status` (PASS/REVIEW/FAIL) is derived from `total_score`, `target_relevance`, `moa_validity`, and `data_maturity` thresholds — see `json/schema.md` for exact cutoffs. `marketability` has its own A/B/C (TAP → unrisked peak sales → obtainable peak sales) calculation with a hard-zero gate when `commercial_rationale_status` is `not_established`. Themes/clusters are a fixed taxonomy (`THEMES`, `CLUSTERS` dicts in `main.py`) — don't invent new theme/cluster values without updating both the backend dicts and `config/category-synonyms.json`.

### Backend (`main.py`, single file, ~2400 lines)

- Record CRUD lives under `/api/records` (GET/POST/PUT list, and `{record_id}` GET/PUT/PATCH/DELETE, where `record_id` is derived via `record_key`). `manual-review` and `focus-management` PATCH endpoints mutate sub-fields in place.
- `POST /api/wiki/export` and `POST /api/obsidian/export` shell out to the `scripts/` exporters as subprocesses and return the regenerated file list — they don't reimplement export logic in-process.
- `/api/chat`, `/api/chat/stream` (SSE), `/api/chat/mock` power an in-dashboard AI assistant that can propose scoring revisions. It calls OpenRouter (`OPENROUTER_API_URL`, model fallback list in `OPENROUTER_DEFAULT_FALLBACK_MODELS`) and, for context, greps the generated `skbp_pipeline_wiki/` notes (`search_wiki_notes`, `agentic_search_wiki_notes`) rather than querying the JSON records directly. `verify=False` is used for OpenRouter requests to work around local SSL inspection (see `.env` / corporate proxy setup) — this is intentional, not an oversight.
- `.env` is parsed by a hand-rolled `load_local_env()` (not python-dotenv) and populates `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, etc.
- Any structural edit to a record's `scoring` should go through `recalculate_total_score` / `update_score` rather than writing scores directly, so total-score and hard-filter derivation stay consistent.

### Frontend (no framework)

Plain HTML + vanilla JS, one file per page, sharing `src/styles.css` and `src/theme.js`:

- `index.html` + `src/app.js` (~4300 lines): main dashboard — table/filters/charts and the paste-JSON-to-save UI, calling `/api/records`, `/api/category-synonyms`, `/api/chat*`.
- `detail.html` + `src/detail.js`: single-record detail/edit view.
- `triage_detail.html`: fast-triage record detail view.
- `wiki_view.html` + `src/wiki_view.js`: renders exported Obsidian/wiki Markdown notes in-browser via `/api/wiki-note` and the `/wiki` static mount.

### Generated Obsidian vaults — do not hand-edit

`obsidian/` (simple export: Pipeline_Index, Assets, Companies, Themes, Clusters) and `skbp_pipeline_wiki/` (richer graph vault: numbered folders `00_System` … `13_Graph_Exports`, entity notes per asset/company/target/MoA/modality/indication/competitor/evidence-source, scorecards, graph CSV/JSON exports) are both fully regenerated from `json/pipeline-records.json` by the scripts in `scripts/`. Each `skbp_pipeline_wiki/*/AGENTS.md` documents the note conventions (frontmatter fields, wikilink rules, naming rules) for that folder — read the relevant one before hand-authoring or reasoning about notes in that folder, but treat the notes themselves as disposable build output: fix the exporter or the source JSON, not the generated Markdown.
