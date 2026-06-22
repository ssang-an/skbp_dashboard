from __future__ import annotations

import json
import copy
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import subprocess
import sys

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
JSON_DIR = ROOT / "json"
DATA_FILE = JSON_DIR / "pipeline-records.json"
SAMPLE_FILE = JSON_DIR / "drug-valuations.sample.json"
SCHEMA_FILE = JSON_DIR / "drug-valuation.schema.json"
OBSIDIAN_DIR = ROOT / "obsidian"
WIKI_DIR = ROOT / "skbp_pipeline_wiki"
SCORING_CRITERIA_VERSION = "3.1"
SCORING_CRITERIA_FULL_MD = ROOT / "config" / "scoring_criteria" / "v3_1_full.md"
SCORING_CRITERIA_DISPLAY_MD = ROOT / "config" / "scoring_criteria" / "v3_1_display.md"

CRITERION_ALIASES = {
    "target_relevance": ["target_relevance", "target relevance", "타깃", "타겟", "target"],
    "competitive_landscape": ["competitive_landscape", "competitive landscape", "경쟁", "competitive"],
    "moa_validity": ["moa_validity", "moa validity", "기전", "moa", "mechanism"],
    "platform_attractiveness": ["platform_attractiveness", "platform attractiveness", "플랫폼", "modality", "platform"],
    "expansion_potential": ["expansion_potential", "expansion potential", "확장", "expansion"],
    "data_maturity": ["data_maturity", "data maturity", "데이터", "성숙", "data"],
    "marketability": ["marketability", "시장성", "market"],
}

CRITERION_IDS = [
    "target_relevance",
    "competitive_landscape",
    "moa_validity",
    "platform_attractiveness",
    "expansion_potential",
    "data_maturity",
    "marketability",
]

EVIDENCE_TYPE_ALLOWED_VALUES = {
    "E0_not_found_or_not_assessable",
    "E1_company_claim_or_scientific_rationale_only",
    "E2_indirect_or_class_level_evidence",
    "E3_asset_specific_preclinical_or_technical_evidence",
    "E4_asset_specific_clinical_evidence",
}

SCORE_ALLOWED_VALUES = {0, 1, 2, 3}
MARKETABILITY_COMMERCIAL_RATIONALE_STATUS_ALLOWED_VALUES = {"established", "not_established"}

RULE_PREFIXES = {
    "target_relevance": "TR",
    "competitive_landscape": "CL",
    "moa_validity": "MOA",
    "platform_attractiveness": "PA",
    "expansion_potential": "EP",
    "data_maturity": "DM",
    "marketability": "MK",
}

THEMES = {
    "E/I Balance": {"id": "ei_balance", "name": "E/I Balance"},
    "Neuroimmune": {"id": "neuroimmune", "name": "Neuroimmune"},
}

CLUSTERS = {
    "Ion Channel": {"id": "ion_channel", "name": "Ion Channel", "theme": "E/I Balance"},
    "Inhibitory Tone 강화": {
        "id": "inhibitory_tone_enhancement",
        "name": "Inhibitory Tone 강화",
        "theme": "E/I Balance",
    },
    "Synaptic Transmission": {"id": "synaptic_transmission", "name": "Synaptic Transmission", "theme": "E/I Balance"},
    "Chloride Homeostasis": {"id": "chloride_homeostasis", "name": "Chloride Homeostasis", "theme": "E/I Balance"},
    "Network Modulation": {"id": "network_modulation", "name": "Network Modulation", "theme": "E/I Balance"},
    "CNS 손상 면역반응": {"id": "cns_injury_immune_response", "name": "CNS 손상 면역반응", "theme": "Neuroimmune"},
    "교세포 향상성": {"id": "glial_homeostasis", "name": "교세포 향상성", "theme": "Neuroimmune"},
    "Cytokine 신경조절": {"id": "cytokine_neuromodulation", "name": "Cytokine 신경조절", "theme": "Neuroimmune"},
    "손상/질환 면역조절": {
        "id": "injury_disease_immune_modulation",
        "name": "손상/질환 면역조절",
        "theme": "Neuroimmune",
    },
    "말초 면역기관 연결": {
        "id": "peripheral_immune_organ_connection",
        "name": "말초 면역기관 연결",
        "theme": "Neuroimmune",
    },
}

app = FastAPI(title="SKBP Pipeline Dashboard")
app.mount("/src", StaticFiles(directory=ROOT / "src"), name="src")
app.mount("/json", StaticFiles(directory=JSON_DIR), name="json")
WIKI_DIR.mkdir(exist_ok=True)
if OBSIDIAN_DIR.exists():
    app.mount("/obsidian", StaticFiles(directory=OBSIDIAN_DIR), name="obsidian")
app.mount("/wiki", StaticFiles(directory=WIKI_DIR), name="wiki")


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Missing file: {path.name}") from None
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON in {path.name}: {exc}") from None


def write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=path.parent, suffix=".tmp") as tmp:
        json.dump(payload, tmp, ensure_ascii=False, indent=2)
        tmp.write("\n")
        temp_name = tmp.name
    Path(temp_name).replace(path)


def normalize_records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict) and isinstance(payload.get("records"), list):
        records = payload["records"]
    elif isinstance(payload, dict) and "structured_table" in payload:
        records = [payload]
    else:
        raise HTTPException(
            status_code=400,
            detail="Paste one analysis JSON object, an array of analysis objects, or { records: [...] }.",
        )

    if not all(isinstance(item, dict) for item in records):
        raise HTTPException(status_code=400, detail="Every record must be a JSON object.")
    return records


def validation_error(message: str) -> None:
    raise HTTPException(status_code=400, detail=message)


def require_list_field(criterion: dict[str, Any], criterion_id: str, field: str) -> None:
    value = criterion.get(field)
    if not isinstance(value, list):
        validation_error(f"{criterion_id}.{field} is required and must be an array.")


def validate_score(value: Any, criterion_id: str) -> None:
    if not isinstance(value, int) or value not in SCORE_ALLOWED_VALUES:
        validation_error(f"{criterion_id}.score must be one integer among 0, 1, 2, 3. Got: {value!r}")


def validate_scoring_criterion(criterion: Any, criterion_id: str) -> None:
    if not isinstance(criterion, dict):
        validation_error(f"{criterion_id} must be an object.")

    validate_score(criterion.get("score"), criterion_id)

    evidence_type = criterion.get("evidence_type")
    if evidence_type not in EVIDENCE_TYPE_ALLOWED_VALUES:
        validation_error(
            f"{criterion_id}.evidence_type is required and must be one of {sorted(EVIDENCE_TYPE_ALLOWED_VALUES)}."
        )

    for field in ["evidence_type_reason", "main_line_summary", "investigation_note", "why_not_higher"]:
        if field not in criterion:
            validation_error(f"{criterion_id}.{field} is required.")

    for field in ["what_was_checked", "evidence_trail", "evidence_sources", "uncertain_points"]:
        require_list_field(criterion, criterion_id, field)


def is_blank(value: Any) -> bool:
    return value is None or value == ""


def validate_marketability(criterion: dict[str, Any]) -> None:
    calculation = criterion.get("calculation")
    if not isinstance(calculation, dict):
        validation_error("marketability.calculation is required and must be an object.")

    status = calculation.get("commercial_rationale_status")
    if status not in MARKETABILITY_COMMERCIAL_RATIONALE_STATUS_ALLOWED_VALUES:
        validation_error(
            "marketability.calculation.commercial_rationale_status must be established or not_established."
        )

    step_a = calculation.get("A_targetable_addressable_patient") or {}
    step_b = calculation.get("B_unrisked_peak_sales") or {}
    step_c = calculation.get("C_obtainable_peak_sales") or {}
    if not all(isinstance(step, dict) for step in [step_a, step_b, step_c]):
        validation_error("marketability.calculation A/B/C steps must be objects.")

    if status == "not_established":
        if criterion.get("score") != 0:
            validation_error("marketability.score must be 0 when commercial_rationale_status is not_established.")
        if is_blank(calculation.get("commercial_rationale_failure_reason")):
            validation_error("marketability.commercial_rationale_failure_reason is required when not_established.")
        for path, value in [
            ("A_targetable_addressable_patient.targetable_addressable_patient", step_a.get("targetable_addressable_patient")),
            ("B_unrisked_peak_sales.unrisked_peak_sales", step_b.get("unrisked_peak_sales")),
            ("C_obtainable_peak_sales.obtainable_peak_sales", step_c.get("obtainable_peak_sales")),
        ]:
            if value is not None:
                validation_error(f"marketability.calculation.{path} must be null when commercial rationale is not_established.")
    else:
        for path, value in [
            ("A_targetable_addressable_patient.targetable_addressable_patient", step_a.get("targetable_addressable_patient")),
            ("B_unrisked_peak_sales.unrisked_peak_sales", step_b.get("unrisked_peak_sales")),
            ("C_obtainable_peak_sales.obtainable_peak_sales", step_c.get("obtainable_peak_sales")),
        ]:
            if is_blank(value):
                validation_error(f"marketability.calculation.{path} is required when commercial rationale is established.")


def validate_stage_specific_fields(criteria: dict[str, Any]) -> None:
    data_maturity = criteria.get("data_maturity") or {}
    for field in ["claimed_development_stage", "expected_data_for_stage", "visible_asset_specific_data"]:
        if field not in data_maturity:
            validation_error(f"data_maturity.{field} is required for v3.1 stage-specific assessment.")


def validate_records_for_save(records: list[dict[str, Any]]) -> None:
    for index, record in enumerate(records):
        criteria = ((record.get("scoring") or {}).get("criteria") or {})
        if not isinstance(criteria, dict):
            validation_error(f"record[{index}].scoring.criteria is required.")

        for criterion_id in CRITERION_IDS:
            if criterion_id not in criteria:
                validation_error(f"record[{index}].scoring.criteria.{criterion_id} is required.")
            validate_scoring_criterion(criteria[criterion_id], criterion_id)

        validate_marketability(criteria["marketability"])
        validate_stage_specific_fields(criteria)


def record_key(record: dict[str, Any]) -> str:
    meta = record.get("meta") or {}
    table = record.get("structured_table") or {}
    summary = record.get("json_summary") or {}
    return (
        meta.get("output_filename_base")
        or f"{table.get('company', summary.get('company', 'unknown'))}_{table.get('asset_name', summary.get('asset_name', 'asset'))}"
    )


def safe_note_name(value: Any, fallback: str = "Untitled") -> str:
    text = str(value or fallback).strip()
    text = re.sub(r'[<>:"/\\\\|?*]', "-", text)
    text = re.sub(r"\s+", " ", text).strip(" .")
    return text or fallback


def ensure_data_file() -> None:
    if DATA_FILE.exists():
        return

    if SAMPLE_FILE.exists():
        sample = read_json(SAMPLE_FILE)
        records = normalize_records(sample)
    else:
        records = []
    write_json_atomic(DATA_FILE, records)


def load_records() -> list[dict[str, Any]]:
    ensure_data_file()
    return normalize_records(read_json(DATA_FILE))


def save_records(records: list[dict[str, Any]]) -> None:
    write_json_atomic(DATA_FILE, records)


def run_obsidian_export() -> dict[str, Any]:
    script = ROOT / "scripts" / "export_obsidian.py"
    if not script.exists():
        return {
            "ok": False,
            "message": "Missing scripts/export_obsidian.py",
            "stdout": "",
            "stderr": "",
        }

    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return {
        "ok": result.returncode == 0,
        "message": "Obsidian markdown regenerated from json/pipeline-records.json"
        if result.returncode == 0
        else "Obsidian export failed",
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def run_wiki_export() -> dict[str, Any]:
    script = ROOT / "scripts" / "export_pipeline_wiki.py"
    if not script.exists():
        return {
            "ok": False,
            "message": "Missing scripts/export_pipeline_wiki.py",
            "stdout": "",
            "stderr": "",
        }

    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return {
        "ok": result.returncode == 0,
        "message": "Pipeline wiki regenerated from json/pipeline-records.json"
        if result.returncode == 0
        else "Pipeline wiki export failed",
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def run_markdown_exports() -> dict[str, Any]:
    return {
        "obsidian": run_obsidian_export(),
        "wiki": run_wiki_export(),
    }


def parse_scalar(value: str) -> Any:
    cleaned = value.strip()
    if not cleaned:
        return ""
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return cleaned.strip("\"'")


def set_existing_path(target: dict[str, Any], path: str, value: Any) -> bool:
    parts = [part for part in path.strip().split(".") if part]
    if not parts:
        return False

    cursor: Any = target
    for part in parts[:-1]:
        if not isinstance(cursor, dict) or part not in cursor:
            return False
        cursor = cursor[part]

    if not isinstance(cursor, dict) or parts[-1] not in cursor:
        return False
    cursor[parts[-1]] = value
    return True


def find_reason_text(message: str) -> str | None:
    match = re.search(r"(?:근거|reason|basis)\s*[:：]\s*(.+)", message, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    return match.group(1).strip()


def recalculate_total_score(record: dict[str, Any]) -> None:
    scoring = record.get("scoring")
    if not isinstance(scoring, dict):
        return

    criteria = scoring.get("criteria")
    if not isinstance(criteria, dict):
        return

    total = 0
    for criterion in criteria.values():
        score = criterion.get("score") if isinstance(criterion, dict) else None
        if isinstance(score, (int, float)):
            total += score
    scoring["total_score"] = total
    scoring["max_score"] = 21


def default_marketability_calculation(existing: dict[str, Any] | None = None) -> dict[str, Any]:
    existing = existing if isinstance(existing, dict) else {}
    if "A_targetable_addressable_patient" in existing:
        return existing
    return {
        "A_targetable_addressable_patient": {
            "total_patient_pool": None,
            "diagnosis_rate": None,
            "eligibility_rate": None,
            "biomarker_positive_rate": None,
            "treatable_subgroup_rate": None,
            "targetable_addressable_patient": None,
            "formula": "TAP = Total Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate",
            "assumption_note": "Estimate actual treatable patients from patient pool, diagnosis, eligibility, biomarker, and subgroup assumptions.",
        },
        "B_unrisked_peak_sales": {
            "tap": None,
            "annual_net_price": None,
            "peak_penetration": None,
            "treatment_duration_factor": None,
            "entry_order_share_assumption": {
                "market_player_count": None,
                "expected_entry_order": None,
                "matrix_share_reference": "Use entry-order matrix as market share reference; e.g., 3-player market: 1st ~50%, 2nd ~30%, 3rd ~20%.",
                "assumption_note": "Peak penetration/share assumption should be justified by expected entry order and competitor count.",
            },
            "unrisked_peak_sales": None,
            "formula": "Unrisked Peak Sales = TAP x Annual Net Price x Peak Penetration x Treatment Duration Factor",
            "assumption_note": "Show TAP, annual net price, penetration/share assumption, and treatment duration factor.",
        },
        "C_obtainable_peak_sales": {
            "unrisked_peak_sales": None,
            "competition_haircut": None,
            "pricing_power_adjustment": None,
            "expansion_capacity_adjustment": None,
            "obtainable_peak_sales": None,
            "formula": "Obtainable Peak Sales = Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment x Expansion Capacity Adjustment",
            "score_basis_note": "Final score is assigned from obtainable peak sales.",
        },
    }


def update_score(record: dict[str, Any], criterion_id: str, score: int, reason: str, changes: list[str]) -> None:
    criteria = record.setdefault("scoring", {}).setdefault("criteria", {})
    criterion = criteria.get(criterion_id)
    if not isinstance(criterion, dict):
        return

    if criterion_id == "marketability" and not all(token in reason for token in ["A.", "B.", "C."]):
        reason = (
            "A. TAP: estimate targetable addressable patients from total patient pool, diagnosis, eligibility, biomarker/subgroup assumptions. "
            "B. Unrisked Peak Sales: calculate TAP x annual net price x peak penetration x treatment duration, using entry-order/share assumptions where relevant. "
            "C. Obtainable Peak Sales: apply competition haircut, pricing power, and expansion capacity to determine the final score. "
            f"User judgment: {reason}"
        )
        criterion["calculation"] = default_marketability_calculation(criterion.get("calculation"))

    criterion["score"] = score
    criterion["main_line_summary"] = reason
    criterion["investigation_note"] = "Updated through AI draft chat. Rubric text is stored separately in the rubric section."
    criterion["uncertain_points"] = ["AI draft update. Reviewer should confirm source-level evidence."]
    criterion.setdefault("evidence_sources", [])
    criterion.pop("reason", None)
    criterion.pop("criteria_reference", None)
    criterion.pop("score_rationale", None)
    criterion.pop("evidence", None)

    if criterion_id == "target_relevance":
        record.setdefault("json_summary", {})["target_relevance_score"] = score

    changes.append(f"{criterion_id}.score -> {score}")


def apply_path_assignments(record: dict[str, Any], message: str, changes: list[str]) -> None:
    assignment_pattern = re.compile(r"([A-Za-z_][\w.]+)\s*=\s*(\".*?\"|'.*?'|[^;\n]+)")
    for match in assignment_pattern.finditer(message):
        path = match.group(1)
        value = parse_scalar(match.group(2))
        if set_existing_path(record, path, value):
            changes.append(f"{path} -> {value}")


def apply_theme_cluster(record: dict[str, Any], message: str, changes: list[str]) -> None:
    lowered = message.lower()
    summary = record.setdefault("json_summary", {})
    target_relevance = record.setdefault("scoring", {}).setdefault("criteria", {}).setdefault("target_relevance", {})
    ai_champion = target_relevance.setdefault("ai_champion", {})

    for theme_name, theme in THEMES.items():
        if theme_name.lower() in lowered:
            summary["theme"] = theme_name
            ai_champion["matched_theme"] = {"id": theme["id"], "name": theme["name"]}
            changes.append(f"json_summary.theme -> {theme_name}")

    for cluster_name, cluster in CLUSTERS.items():
        if cluster_name.lower() in lowered:
            summary["cluster"] = cluster_name
            summary["theme"] = cluster["theme"]
            ai_champion["matched_cluster"] = {"id": cluster["id"], "name": cluster["name"]}
            ai_champion["matched_theme"] = THEMES[cluster["theme"]]
            changes.append(f"json_summary.cluster -> {cluster_name}")


def append_source_from_message(record: dict[str, Any], message: str, changes: list[str]) -> None:
    urls = re.findall(r"https?://[^\s)>\]]+", message)
    source_requested = any(
        keyword in message.lower()
        for keyword in ["source", "evidence", "서치", "검색", "출처", "논문", "pmid", "url"]
    )
    if not urls and not source_requested:
        return

    sources = record.setdefault("structured_table", {}).setdefault("sources", [])
    if not isinstance(sources, list):
        return

    source = {
        "source_id": f"ai-draft-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "source_title": "AI draft search note",
        "source_url": urls[0] if urls else None,
        "source_excerpt": message[:500],
    }
    sources.append(source)
    changes.append("structured_table.sources +1")


def append_criterion_evidence(record: dict[str, Any], message: str, changes: list[str]) -> None:
    lowered = message.lower()
    evidence_requested = any(
        keyword in lowered
        for keyword in ["source", "evidence", "서치", "검색", "출처", "논문", "pmid", "url", "근거 추가"]
    )
    if not evidence_requested:
        return

    criteria = record.setdefault("scoring", {}).setdefault("criteria", {})
    for criterion_id, aliases in CRITERION_ALIASES.items():
        if not any(alias.lower() in lowered for alias in aliases):
            continue
        criterion = criteria.get(criterion_id)
        if not isinstance(criterion, dict):
            continue
        evidence_sources = criterion.setdefault("evidence_sources", [])
        if isinstance(evidence_sources, list):
            evidence_sources.append(
                {
                    "source_id": f"ai-evidence-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                    "source_title": "AI draft evidence note",
                    "source_url": None,
                    "source_type": "other",
                    "published_at": None,
                    "accessed_at": datetime.now(timezone.utc).date().isoformat(),
                    "evidence_summary": message[:500],
                    "relevance_to_assessment": f"User-provided evidence note for {criterion_id}.",
                    "supports_score": None,
                    "reliability": "Unclear",
                }
            )
            changes.append(f"scoring.criteria.{criterion_id}.evidence_sources +1")


def build_ai_draft(record: dict[str, Any], message: str) -> dict[str, Any] | None:
    draft = copy.deepcopy(record)
    changes: list[str] = []
    reason = find_reason_text(message) or f"AI draft instruction: {message}"
    lowered = message.lower()

    apply_path_assignments(draft, message, changes)
    apply_theme_cluster(draft, message, changes)
    append_source_from_message(draft, message, changes)
    append_criterion_evidence(draft, message, changes)

    for criterion_id, aliases in CRITERION_ALIASES.items():
        for alias in aliases:
            alias_pattern = re.escape(alias.lower())
            score_patterns = [
                rf"{alias_pattern}.{{0,80}}?(?:score|점수)\s*[=:]?\s*([0-3])\b",
                rf"{alias_pattern}.{{0,80}}?\b([0-3])\s*점",
                rf"\b([0-3])\s*점.{{0,80}}?{alias_pattern}",
            ]
            score_match = next(
                (
                    re.search(pattern, lowered, flags=re.DOTALL)
                    for pattern in score_patterns
                    if re.search(pattern, lowered, flags=re.DOTALL)
                ),
                None,
            )
            if score_match:
                update_score(draft, criterion_id, int(score_match.group(1)), reason, changes)
                break

    if not changes:
        return None

    recalculate_total_score(draft)
    return {"record": draft, "changes": changes}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(ROOT / "index.html")


@app.get("/detail")
def detail() -> FileResponse:
    return FileResponse(ROOT / "detail.html")


@app.get("/api/records")
def get_records() -> dict[str, Any]:
    records = load_records()
    return {
        "records": records,
        "data_file": str(DATA_FILE.relative_to(ROOT)).replace("\\", "/"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/obsidian/assets/{record_id:path}")
def get_obsidian_asset(record_id: str) -> dict[str, Any]:
    records = load_records()
    record = next((item for item in records if record_key(item) == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")

    note_title = (
        (record.get("obsidian") or {}).get("note_title")
        or (record.get("meta") or {}).get("output_filename_base")
        or record_id
    )
    safe_title = safe_note_name(note_title)
    note_path = OBSIDIAN_DIR / "Assets" / f"{safe_title}.md"

    if not note_path.exists():
        return {
            "exists": False,
            "record_id": record_id,
            "note_title": safe_title,
            "path": str(note_path.relative_to(ROOT)).replace("\\", "/"),
            "content": "",
        }

    return {
        "exists": True,
        "record_id": record_id,
        "note_title": safe_title,
        "path": str(note_path.relative_to(ROOT)).replace("\\", "/"),
        "content": note_path.read_text(encoding="utf-8"),
    }


@app.post("/api/records/delete")
async def delete_records(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from None

    ids = payload.get("ids") if isinstance(payload, dict) else None
    if not isinstance(ids, list) or not ids:
        raise HTTPException(status_code=400, detail="Expected { ids: [...] }.")

    requested_ids = {str(item).strip() for item in ids if str(item).strip()}
    if not requested_ids:
        raise HTTPException(status_code=400, detail="No valid record ids provided.")

    records = load_records()
    kept: list[dict[str, Any]] = []
    deleted_ids: list[str] = []
    for record in records:
        key = record_key(record)
        if key in requested_ids:
            deleted_ids.append(key)
        else:
            kept.append(record)

    if not deleted_ids:
        raise HTTPException(status_code=404, detail="No matching records found.")

    save_records(kept)
    exports = run_markdown_exports()
    return {
        "ok": True,
        "deleted": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "missing_ids": sorted(requested_ids - set(deleted_ids)),
        "total": len(kept),
        "data_file": str(DATA_FILE.relative_to(ROOT)).replace("\\", "/"),
        "exports": exports,
    }


@app.get("/api/records/{record_id:path}")
def get_record(record_id: str) -> dict[str, Any]:
    records = load_records()
    for record in records:
        if record_key(record) == record_id:
            return {"record": record, "record_id": record_id}
    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


@app.put("/api/records/{record_id:path}")
async def update_record(record_id: str, request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from None

    if not isinstance(payload, dict) or "structured_table" not in payload:
        raise HTTPException(status_code=400, detail="Expected one analysis JSON object.")
    validate_records_for_save([payload])

    records = load_records()
    for index, record in enumerate(records):
        if record_key(record) == record_id:
            records[index] = payload
            save_records(records)
            exports = run_markdown_exports()
            return {
                "ok": True,
                "record_id": record_key(payload),
                "updated_previous_id": record_id,
                "total": len(records),
                "exports": exports,
            }
    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


@app.delete("/api/records/{record_id:path}")
def delete_record(record_id: str) -> dict[str, Any]:
    records = load_records()
    kept = [record for record in records if record_key(record) != record_id]
    deleted = len(records) - len(kept)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")

    save_records(kept)
    exports = run_markdown_exports()
    return {
        "ok": True,
        "deleted": deleted,
        "deleted_ids": [record_id],
        "total": len(kept),
        "data_file": str(DATA_FILE.relative_to(ROOT)).replace("\\", "/"),
        "exports": exports,
    }


@app.post("/api/records")
async def upsert_records(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from None

    incoming = normalize_records(payload)
    validate_records_for_save(incoming)
    records = load_records()
    index_by_key = {record_key(record): i for i, record in enumerate(records)}
    inserted = 0
    updated = 0

    for record in incoming:
        key = record_key(record)
        if key in index_by_key:
            records[index_by_key[key]] = record
            updated += 1
        else:
            index_by_key[key] = len(records)
            records.append(record)
            inserted += 1

    save_records(records)
    exports = run_markdown_exports()
    return {
        "ok": True,
        "inserted": inserted,
        "updated": updated,
        "total": len(records),
        "data_file": str(DATA_FILE.relative_to(ROOT)).replace("\\", "/"),
        "exports": exports,
    }


@app.put("/api/records")
async def replace_records(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from None

    records = normalize_records(payload)
    validate_records_for_save(records)
    save_records(records)
    exports = run_markdown_exports()
    return {
        "ok": True,
        "replaced": len(records),
        "total": len(records),
        "data_file": str(DATA_FILE.relative_to(ROOT)).replace("\\", "/"),
        "exports": exports,
    }


@app.get("/api/schema")
def get_schema() -> Any:
    return read_json(SCHEMA_FILE)


@app.get("/api/scoring-criteria")
def get_scoring_criteria() -> dict[str, Any]:
    return {
        "version": SCORING_CRITERIA_VERSION,
        "full_markdown": SCORING_CRITERIA_FULL_MD.read_text(encoding="utf-8"),
        "display_markdown": SCORING_CRITERIA_DISPLAY_MD.read_text(encoding="utf-8"),
        "evidence_type_allowed_values": sorted(EVIDENCE_TYPE_ALLOWED_VALUES),
        "score_allowed_values": sorted(SCORE_ALLOWED_VALUES),
        "marketability_commercial_rationale_status_allowed_values": sorted(
            MARKETABILITY_COMMERCIAL_RATIONALE_STATUS_ALLOWED_VALUES
        ),
    }


@app.post("/api/obsidian/export")
def export_obsidian() -> dict[str, Any]:
    script = ROOT / "scripts" / "export_obsidian.py"
    if not script.exists():
        raise HTTPException(status_code=404, detail="Missing scripts/export_obsidian.py")

    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or result.stdout)

    files = [str(path.relative_to(ROOT)).replace("\\", "/") for path in OBSIDIAN_DIR.rglob("*.md")]
    return {
        "ok": True,
        "message": "Obsidian markdown regenerated from json/pipeline-records.json",
        "files": files,
        "count": len(files),
    }


@app.post("/api/wiki/export")
def export_pipeline_wiki() -> dict[str, Any]:
    script = ROOT / "scripts" / "export_pipeline_wiki.py"
    if not script.exists():
        raise HTTPException(status_code=404, detail="Missing scripts/export_pipeline_wiki.py")

    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or result.stdout)

    files = [str(path.relative_to(ROOT)).replace("\\", "/") for path in WIKI_DIR.rglob("*") if path.is_file()]
    return {
        "ok": True,
        "message": "Pipeline wiki regenerated from json/pipeline-records.json",
        "summary": json.loads(result.stdout) if result.stdout.strip().startswith("{") else result.stdout,
        "files": files,
        "count": len(files),
    }


@app.post("/api/markdown/export")
def export_markdown_layers() -> dict[str, Any]:
    return {"ok": True, "exports": run_markdown_exports()}


@app.post("/api/chat")
async def chat_with_record(request: Request) -> dict[str, Any]:
    payload = await request.json()
    record_id = payload.get("record_id")
    message = (payload.get("message") or "").strip()

    if not record_id or not message:
        raise HTTPException(status_code=400, detail="record_id and message are required.")

    records = load_records()
    record = next((item for item in records if record_key(item) == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")

    summary = record.get("json_summary") or {}
    scoring = record.get("scoring") or {}
    criteria = scoring.get("criteria") or {}
    target_relevance = criteria.get("target_relevance") or {}
    draft = build_ai_draft(record, message)

    reply = (
        "현재는 로컬 AI draft scaffold 응답입니다. "
        "점수나 JSON path 변경 의도가 감지되면 적용 가능한 JSON 수정 초안을 함께 반환합니다.\n\n"
        f"- Asset: {summary.get('asset_name', '-')}\n"
        f"- Company: {summary.get('company', '-')}\n"
        f"- Target: {summary.get('target', '-')}\n"
        f"- Theme: {summary.get('theme', '-')} / Cluster: {summary.get('cluster', '-')}\n"
        f"- Total score: {scoring.get('total_score', '-')} / {scoring.get('max_score', '-')}\n"
        f"- Target relevance reason: {target_relevance.get('main_line_summary') or target_relevance.get('reason', '-')}"
    )
    if draft:
        reply += "\n\n수정 초안을 만들었습니다. 화면의 '초안 적용' 버튼을 누르면 이 record JSON에 바로 저장됩니다."
    else:
        reply += (
            "\n\n수정하려면 예를 들어 `marketability 2점, 근거: obtainable peak sales가 1B 이상으로 추정됨` "
            "또는 `structured_table.moa=\"updated MoA text\"`처럼 입력하세요."
        )

    return {
        "reply": reply,
        "draft_record": draft["record"] if draft else None,
        "draft_changes": draft["changes"] if draft else [],
    }
