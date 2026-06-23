from __future__ import annotations

import json
import copy
import os
import re
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import subprocess
import sys

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
JSON_DIR = ROOT / "json"
DATA_FILE = JSON_DIR / "pipeline-records.json"
SAMPLE_FILE = JSON_DIR / "drug-valuations.sample.json"
SCHEMA_FILE = JSON_DIR / "drug-valuation.schema.json"
OBSIDIAN_DIR = ROOT / "obsidian"
WIKI_DIR = ROOT / "skbp_pipeline_wiki"
SCORING_CRITERIA_VERSION = "3.1"
TRIAGE_CRITERIA_VERSION = SCORING_CRITERIA_VERSION
SCORING_CRITERIA_FULL_MD = ROOT / "config" / "scoring_criteria" / "v3_1_full.md"
SCORING_CRITERIA_DISPLAY_MD = ROOT / "config" / "scoring_criteria" / "v3_1_display.md"
CATEGORY_SYNONYMS_FILE = ROOT / "config" / "category-synonyms.json"
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_DEFAULT_MODEL = "openrouter/free"
OPENROUTER_DEFAULT_FALLBACK_MODELS = [
    "openai/gpt-oss-20b:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
]
CHAT_JSON_CONTEXT_LIMIT = 6500
CHAT_DASHBOARD_CONTEXT_LIMIT = 2500
CHAT_WIKI_SNIPPET_LIMIT = 1100
CHAT_WIKI_TOP_K = 5
OPENROUTER_MAX_TOKENS = int(os.getenv("OPENROUTER_MAX_TOKENS", "1200"))


def load_local_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip().lstrip("\ufeff"), value.strip().strip('"').strip("'"))


load_local_env()

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


def validate_triage_scoring_criterion(criterion: Any, criterion_id: str) -> None:
    if not isinstance(criterion, dict):
        validation_error(f"{criterion_id} must be an object.")
    validate_score(criterion.get("score"), criterion_id)
    if "main_line_summary" in criterion and not isinstance(criterion.get("main_line_summary"), str):
        validation_error(f"{criterion_id}.main_line_summary must be a string when provided.")
    for field in ["evidence_sources", "uncertain_points"]:
        if field in criterion and not isinstance(criterion.get(field), list):
            validation_error(f"{criterion_id}.{field} must be an array when provided.")


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

        if is_fast_triage_record(record):
            for criterion_id in ["target_relevance", "moa_validity", "data_maturity"]:
                if criterion_id not in criteria:
                    validation_error(f"record[{index}].scoring.criteria.{criterion_id} is required for fast triage.")
                validate_triage_scoring_criterion(criteria[criterion_id], criterion_id)
            continue

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


def score_from_revision_text(text: str) -> int | None:
    normalized = str(text or "")
    score_matches = []
    score_matches.extend(
        re.findall(r"(?:->|→|to|로|으로)\s*([0-3])\s*(?:점|/\s*3)?", normalized, flags=re.IGNORECASE)
    )
    score_matches.extend(
        re.findall(r"(?:score|점수|평가)\s*[:=]?\s*([0-3])\s*(?:점|/\s*3)?", normalized, flags=re.IGNORECASE)
    )
    score_matches.extend(re.findall(r"(?<![\d.])([0-3])\s*/\s*3(?![\d.])", normalized))
    score_matches.extend(re.findall(r"(?<![\d.])([0-3])\s*점(?![\d.])", normalized))
    if not score_matches:
        return None
    return int(score_matches[-1])


def criterion_revision_snippet(message: str, aliases: list[str]) -> str | None:
    lines = [line.strip() for line in str(message or "").splitlines() if line.strip()]
    lowered_aliases = [alias.lower() for alias in aliases]
    for index, line in enumerate(lines):
        lowered = line.lower()
        if not any(alias in lowered for alias in lowered_aliases):
            continue
        window = [line]
        for next_line in lines[index + 1 : index + 3]:
            next_lowered = next_line.lower()
            if any(
                other_alias in next_lowered
                for criterion, other_aliases in CRITERION_ALIASES.items()
                for other_alias in other_aliases
                if criterion and other_alias.lower() not in lowered_aliases
            ):
                break
            window.append(next_line)
        return " ".join(window)[:1000]
    return None


def is_fast_triage_record(record: dict[str, Any]) -> bool:
    meta = record.get("meta") if isinstance(record.get("meta"), dict) else {}
    source_report = record.get("source_report") if isinstance(record.get("source_report"), dict) else {}
    review_type = str(meta.get("review_type") or "").lower()
    parser_status = str(source_report.get("parser_status") or "").lower()
    source_format = str(source_report.get("source_format") or "").lower()
    return (
        review_type == "fast_triage"
        or "triage" in parser_status
        or "fast_triage" in source_format
        or isinstance(record.get("triage"), dict)
    )


def next_minor_version(version: Any, default_version: str) -> str:
    text = str(version or "").strip().lstrip("vV") or default_version
    match = re.match(r"^(\d+)(?:\.(\d+))?", text)
    if not match:
        text = default_version
        match = re.match(r"^(\d+)(?:\.(\d+))?", text)
    major = int(match.group(1)) if match else 1
    minor = int(match.group(2) or 0) if match else 0
    return f"{major}.{minor + 1}"


def next_triage_revision_version(version: Any) -> str:
    text = str(version or "").strip().lstrip("vV")
    base = TRIAGE_CRITERIA_VERSION
    match = re.match(rf"^{re.escape(base)}-r(\d+)$", text, flags=re.IGNORECASE)
    if match:
        return f"{base}-r{int(match.group(1)) + 1}"
    return f"{base}-r1"


def prepare_revision_context(record: dict[str, Any]) -> dict[str, Any]:
    if not is_fast_triage_record(record):
        return {
            "workflow": "full_scout",
            "display_name": "SKBP Pipeline Finder",
            "instruction_label": "GPT 지침 2",
            "version": SCORING_CRITERIA_VERSION,
            "incremented": False,
        }

    meta = record.setdefault("meta", {})
    triage = record.setdefault("triage", {})
    previous_version = (
        triage.get("instruction_version")
        or meta.get("rubric_version")
        or TRIAGE_CRITERIA_VERSION
    )
    next_version = next_triage_revision_version(previous_version)
    meta["rubric_version"] = next_version
    triage["instruction_version"] = next_version
    return {
        "workflow": "fast_triage",
        "display_name": "SKBP Fast Triage",
        "instruction_label": "GPT 지침 1",
        "version": next_version,
        "incremented": True,
        "previous_version": str(previous_version),
    }


def apply_ai_revision_scores(record: dict[str, Any], answer_markdown: str, changes: list[str]) -> None:
    criteria = record.setdefault("scoring", {}).setdefault("criteria", {})
    revision_context = record.get("_revision_context") if isinstance(record.get("_revision_context"), dict) else {}
    revision_label = (
        f"{revision_context.get('instruction_label')} v{revision_context.get('version')}"
        if revision_context.get("version")
        else f"v{SCORING_CRITERIA_VERSION}"
    )
    for criterion_id, aliases in CRITERION_ALIASES.items():
        criterion = criteria.get(criterion_id)
        if not isinstance(criterion, dict):
            continue
        snippet = criterion_revision_snippet(answer_markdown, aliases)
        if not snippet:
            continue

        new_score = score_from_revision_text(snippet)
        if new_score is None:
            continue

        old_score = criterion.get("score")
        reason = (
            f"AI Agent {revision_label} re-evaluation update. "
            f"Applied from detail chat answer: {snippet}"
        )
        update_score(record, criterion_id, new_score, reason, changes)
        if old_score != new_score:
            changes[-1] = f"{criterion_id}.score {old_score} -> {new_score}"


def annotate_source_report_version(
    raw_markdown: str,
    applied_date: str,
    revision_context: dict[str, Any],
) -> tuple[str, bool]:
    version = str(revision_context.get("version") or SCORING_CRITERIA_VERSION)
    display_name = str(revision_context.get("display_name") or "SKBP Pipeline Finder")
    instruction_label = str(revision_context.get("instruction_label") or "GPT 지침 2")
    if revision_context.get("workflow") == "fast_triage":
        title = f"지침 업데이트 ({instruction_label} v{version})"
        updated_phrase = f"{display_name} {instruction_label} v{version} 기준으로 재평가 및 업데이트"
    else:
        title = f"기준 업데이트 (v{version})"
        updated_phrase = f"{display_name} v{version} 기준으로 재평가 및 업데이트"

    banner = (
        f"> **{title}:** "
        "이 원문은 최초 작성 기준을 보존하되, "
        f"{applied_date} Detail AI Agent 검토를 통해 "
        f"**{updated_phrase}**되었습니다. "
        "최신 판단은 JSON fields와 아래 Revision Note를 기준으로 봅니다."
    )
    marker = f"> **{title}:**"
    text = raw_markdown or ""

    if marker in text:
        updated = re.sub(
            rf"> \*\*{re.escape(title)}:\*\* [^\n]+",
            banner,
            text,
            count=1,
        )
        return updated, updated != text

    if revision_context.get("workflow") == "fast_triage":
        updated = re.sub(
            r"> \*\*지침 업데이트 \(GPT 지침 1 v\d+(?:\.\d+)?(?:-r\d+)?\):\*\* [^\n]+",
            banner,
            text,
            count=1,
        )
        if updated != text:
            return updated, True

    lines = text.splitlines()
    for index, line in enumerate(lines):
        if re.search(r"SKBP Pipeline Finder v\d+(?:\.\d+)?|SKBP Fast Triage|GPT 지침 1", line):
            insert_at = index + 1
            while insert_at < len(lines) and lines[insert_at].strip():
                insert_at += 1
            lines[insert_at:insert_at] = ["", banner]
            return "\n".join(lines), True

    if lines and lines[0].startswith("#"):
        lines[1:1] = ["", banner]
        return "\n".join(lines), True

    return f"{banner}\n\n{text}".rstrip(), True


def append_source_report_revision(
    record: dict[str, Any],
    answer_markdown: str,
    changes: list[str],
    instruction: str = "",
    revision_context: dict[str, Any] | None = None,
) -> None:
    revision_context = revision_context or {
        "workflow": "full_scout",
        "display_name": "SKBP Pipeline Finder",
        "instruction_label": "GPT 지침 2",
        "version": SCORING_CRITERIA_VERSION,
    }
    source_report = record.setdefault("source_report", {})
    raw_markdown = source_report.get("raw_markdown")
    raw_markdown = raw_markdown if isinstance(raw_markdown, str) else ""
    applied_at = datetime.now(timezone.utc).isoformat()
    revision_version = str(revision_context.get("version") or SCORING_CRITERIA_VERSION)
    instruction_label = str(revision_context.get("instruction_label") or "GPT 지침 2")
    instruction_line = instruction.strip() or f"Detail AI Agent {instruction_label} v{revision_version} re-evaluation"
    answer = answer_markdown.strip()
    raw_markdown, version_annotated = annotate_source_report_version(raw_markdown, applied_at[:10], revision_context)
    if version_annotated:
        changes.append(f"source_report.raw_markdown {instruction_label} v{revision_version} update badge")
    change_lines = "\n".join(f"- {change}" for change in changes) or "- No structured score/path changes detected."

    revision_block = (
        "\n\n---\n\n"
        f"## AI Agent Revision Note ({instruction_label} v{revision_version}, {applied_at[:10]})\n\n"
        f"- Revision basis: {instruction_line}\n"
        f"- Version applied: {instruction_label} v{revision_version}\n"
        f"- Applied at: {applied_at}\n"
        "- Scope: JSON scoring fields and source report amendment generated from detail-page Agent discussion.\n\n"
        "### Applied JSON Changes\n\n"
        f"{change_lines}\n\n"
        "### Agent Discussion Summary Used For Revision\n\n"
        f"{answer or '-'}\n"
    )
    source_report["raw_markdown"] = f"{raw_markdown.rstrip()}{revision_block}"
    history = source_report.setdefault("revision_history", [])
    if isinstance(history, list):
        history.append(
            {
                "created_at": applied_at,
                "source": "detail_ai_agent",
                "instruction": instruction_line,
                "instruction_label": instruction_label,
                "rubric_version": revision_version,
                "workflow": revision_context.get("workflow") or "full_scout",
                "changes": changes[:],
            }
        )
    source_report["parser_status"] = (
        "fast_triage_ai_revision_applied"
        if revision_context.get("workflow") == "fast_triage"
        else "ai_revision_applied"
    )
    changes.append("source_report.raw_markdown + AI Agent Revision Note")


def build_ai_revision_update(
    record: dict[str, Any],
    answer_markdown: str,
    instruction: str = "",
) -> dict[str, Any]:
    draft = copy.deepcopy(record)
    changes: list[str] = []
    message = answer_markdown.strip()
    revision_context = prepare_revision_context(draft)
    draft["_revision_context"] = revision_context
    if revision_context.get("incremented"):
        changes.append(
            f"meta.rubric_version {revision_context.get('previous_version')} -> {revision_context.get('version')}"
        )

    apply_path_assignments(draft, message, changes)
    apply_theme_cluster(draft, message, changes)
    append_source_from_message(draft, message, changes)
    append_criterion_evidence(draft, message, changes)
    apply_ai_revision_scores(draft, message, changes)
    if is_fast_triage_record(draft):
        scoring = draft.setdefault("scoring", {})
        scoring["total_score"] = None
        scoring["max_score"] = 21
    else:
        recalculate_total_score(draft)
    append_source_report_revision(draft, message, changes, instruction, revision_context)
    draft.pop("_revision_context", None)
    return {"record": draft, "changes": changes}


def compact_chat_context(record: dict[str, Any]) -> str:
    scoring = record.get("scoring") or {}
    criteria = scoring.get("criteria") or {}
    compact_criteria: dict[str, Any] = {}
    for key, item in criteria.items():
        if not isinstance(item, dict):
            continue
        compact_criteria[key] = {
            "score": item.get("score"),
            "judgment": item.get("main_line_summary") or item.get("reason"),
            "why_not_higher": item.get("why_not_higher"),
            "uncertain_points": item.get("uncertain_points"),
            "evidence_type": item.get("evidence_type"),
            "evidence_sources": get_limited_list({"sources": item.get("evidence_sources")}, "sources", 3),
        }

    context = {
        "json_summary": record.get("json_summary"),
        "pipeline_snapshot": {
            "company": get_nested(record, "structured_table.company"),
            "asset_name": get_nested(record, "structured_table.asset_name"),
            "target": get_nested(record, "structured_table.target"),
            "indication": get_nested(record, "structured_table.indication"),
            "development_stage": get_nested(record, "structured_table.development_stage"),
            "modality_platform": get_nested(record, "structured_table.modality_platform"),
        },
        "scoring": {
            "total_score": scoring.get("total_score"),
            "max_score": scoring.get("max_score"),
            "recommendation": scoring.get("recommendation"),
            "criteria": compact_criteria,
        },
        "hard_filter": record.get("hard_filter"),
        "competitive_analysis": {
            "competitive_density": get_nested(record, "competitive_analysis.competitive_density"),
            "similarity_summary": get_nested(record, "competitive_analysis.similarity_summary"),
            "key_competitors": get_limited_list(record, "competitive_analysis.key_competitors", 5),
        },
        "validation": {
            "cross_checked_facts": get_limited_list(record, "validation.cross_checked_facts", 4),
            "uncertain_points": get_limited_list(record, "validation.uncertain_points", 6),
        },
        "final_insight": record.get("final_insight"),
    }
    text = json.dumps(context, ensure_ascii=False, indent=2)
    return text[:CHAT_JSON_CONTEXT_LIMIT]


def tokenize_for_search(text: str) -> set[str]:
    tokens = {
        token.lower()
        for token in re.findall(r"[A-Za-z0-9가-힣βΒαΑ/\-_.]+", text or "")
        if len(token) >= 2
    }
    stopwords = {
        "the", "and", "for", "with", "this", "that", "asset", "assets", "score", "scores",
        "pipeline", "pipelines", "find", "best", "strong", "platform", "fit", "current",
    }
    return {token for token in tokens if token not in stopwords}


def build_wiki_search_query(record: dict[str, Any], message: str, dashboard_context: str = "") -> str:
    summary = record.get("json_summary") or {}
    fields = [
        message,
        dashboard_context,
        summary.get("asset_name", ""),
        summary.get("company", ""),
        summary.get("target", ""),
        summary.get("theme", ""),
        summary.get("cluster", ""),
        get_nested(record, "structured_table.indication", ""),
    ]
    return "\n".join(str(item) for item in fields if item)


def make_wiki_snippet(text: str, terms: set[str], limit: int = CHAT_WIKI_SNIPPET_LIMIT) -> str:
    clean = re.sub(r"\n{3,}", "\n\n", text.strip())
    if len(clean) <= limit:
        return clean

    lowered = clean.lower()
    positions = [lowered.find(term) for term in terms if len(term) >= 3 and lowered.find(term) >= 0]
    center = min(positions) if positions else 0
    start = max(0, center - limit // 3)
    end = min(len(clean), start + limit)
    snippet = clean[start:end].strip()
    if start:
        snippet = "..." + snippet
    if end < len(clean):
        snippet += "..."
    return snippet


def search_wiki_notes(query: str, top_k: int = CHAT_WIKI_TOP_K) -> list[dict[str, str | int]]:
    if not WIKI_DIR.exists():
        return []

    terms = tokenize_for_search(query)
    if not terms:
        return []

    results: list[dict[str, str | int]] = []
    for path in WIKI_DIR.rglob("*.md"):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        haystack = f"{path.name}\n{path.relative_to(WIKI_DIR)}\n{text}".lower()
        score = 0
        matched_terms: list[str] = []
        for term in terms:
            count = haystack.count(term)
            if count:
                matched_terms.append(term)
                score += min(count, 8)
                if term in path.name.lower():
                    score += 8
                if term in str(path.parent.relative_to(WIKI_DIR)).lower():
                    score += 4

        if score <= 0:
            continue

        relative_path = path.relative_to(WIKI_DIR).as_posix()
        results.append({
            "path": relative_path,
            "score": score,
            "matched_terms": ", ".join(matched_terms[:10]),
            "snippet": make_wiki_snippet(text, set(matched_terms)),
        })

    results.sort(key=lambda item: int(item["score"]), reverse=True)
    return results[:top_k]


def format_wiki_context(snippets: list[dict[str, str | int]]) -> str:
    if not snippets:
        return "No relevant wiki notes found."
    blocks = []
    for index, item in enumerate(snippets, 1):
        blocks.append(
            f"[Wiki {index}] {item['path']} (score {item['score']}, matched: {item['matched_terms']})\n"
            f"{item['snippet']}"
        )
    return "\n\n---\n\n".join(blocks)


def get_limited_list(record: dict[str, Any], path: str, limit: int) -> list[Any]:
    value = get_nested(record, path, [])
    return value[:limit] if isinstance(value, list) else []


def get_nested(record: dict[str, Any], path: str, fallback: Any = None) -> Any:
    current: Any = record
    for key in path.split("."):
        if not isinstance(current, dict):
            return fallback
        current = current.get(key)
    return fallback if current is None else current


def openrouter_models_to_try() -> list[str]:
    primary = os.getenv("OPENROUTER_MODEL", OPENROUTER_DEFAULT_MODEL).strip() or OPENROUTER_DEFAULT_MODEL
    fallback_text = os.getenv("OPENROUTER_FALLBACK_MODELS", ",".join(OPENROUTER_DEFAULT_FALLBACK_MODELS))
    candidates = [primary] + [item.strip() for item in fallback_text.split(",") if item.strip()]

    models: list[str] = []
    for model in candidates:
        if model not in models:
            models.append(model)
    return models


def summarize_openrouter_error(detail: str) -> str:
    try:
        parsed = json.loads(detail)
    except json.JSONDecodeError:
        return detail[:500]

    error = parsed.get("error") if isinstance(parsed, dict) else None
    if isinstance(error, dict):
        message = error.get("message") or "OpenRouter error"
        code = error.get("code")
        metadata = error.get("metadata") if isinstance(error.get("metadata"), dict) else {}
        raw = metadata.get("raw")
        provider = metadata.get("provider_name")
        parts = [str(message)]
        if code is not None:
            parts.append(f"code={code}")
        if provider:
            parts.append(f"provider={provider}")
        if raw and raw != message:
            parts.append(str(raw))
        return " | ".join(parts)[:700]

    return json.dumps(parsed, ensure_ascii=False)[:500]


def call_openrouter_chat(
    record: dict[str, Any],
    message: str,
    dashboard_context: str = "",
) -> tuple[str | None, str | None, list[dict[str, str | int]]]:
    dashboard_context = (dashboard_context or "")[:CHAT_DASHBOARD_CONTEXT_LIMIT]
    wiki_snippets = search_wiki_notes(build_wiki_search_query(record, message, dashboard_context))
    wiki_context = format_wiki_context(wiki_snippets)

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None, "OPENROUTER_API_KEY is not set.", wiki_snippets

    base_payload = {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an internal AI assistant for SKBP Pipeline Finder. "
                    "Answer in Korean unless the user asks otherwise. "
                    "Use only the provided compact JSON, dashboard rows, and retrieved SKBP wiki notes. "
                    "Act like a practical pipeline diligence agent: retrieve, compare, then answer. "
                    "Never use markdown tables. Use short bullet sections only. "
                    "For comparisons, list one asset per bullet with score, rationale, and caveat. "
                    "Cite wiki note filenames or evidence URLs when available. "
                    "If evidence is missing, say what is uncertain and what to verify next. "
                    "Do not invent URLs or unsupported claims. "
                    "Keep the answer concise enough to fit in a chat panel, usually under 450 words."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Compact pipeline JSON context:\n"
                    f"{compact_chat_context(record)}\n\n"
                    "Dashboard visible rows context:\n"
                    f"{dashboard_context or 'No dashboard context provided.'}\n\n"
                    "Retrieved SKBP wiki notes:\n"
                    f"{wiki_context}\n\n"
                    "User question:\n"
                    f"{message}"
                ),
            },
        ],
        "temperature": 0.2,
        "max_tokens": OPENROUTER_MAX_TOKENS,
    }

    errors: list[str] = []
    for model in openrouter_models_to_try():
        payload = {**base_payload, "model": model}
        request = urllib.request.Request(
            OPENROUTER_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://127.0.0.1:8000"),
                "X-Title": os.getenv("OPENROUTER_APP_TITLE", "SKBP Pipeline Finder"),
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            errors.append(f"{model}: HTTP {exc.code} - {summarize_openrouter_error(detail)}")
            if exc.code in {401, 402, 403} or "free-models-per-day" in detail.lower():
                break
            continue
        except Exception as exc:
            errors.append(f"{model}: request failed - {exc}")
            continue

        error = data.get("error") if isinstance(data, dict) else None
        if error:
            detail = json.dumps(data, ensure_ascii=False)
            errors.append(f"{model}: {summarize_openrouter_error(detail)}")
            if "free-models-per-day" in detail.lower():
                break
            continue

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            errors.append(f"{model}: unexpected response - {json.dumps(data, ensure_ascii=False)[:500]}")
            continue

        if content:
            return content, None, wiki_snippets
        errors.append(f"{model}: empty response")

    return None, " / ".join(errors[:4]) or "OpenRouter returned no usable response.", wiki_snippets


def fallback_chat_reply(record: dict[str, Any], draft: dict[str, Any] | None) -> str:
    summary = record.get("json_summary") or {}
    scoring = record.get("scoring") or {}
    criteria = scoring.get("criteria") or {}
    target_relevance = criteria.get("target_relevance") or {}

    reply = (
        "OpenRouter API key가 설정되지 않아 로컬 mock 답변으로 응답합니다.\n\n"
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
        reply += "\n\n실제 AI 답변을 사용하려면 서버 환경변수 `OPENROUTER_API_KEY`를 설정한 뒤 uvicorn을 재시작하세요."
    return reply


def fallback_chat_reply(record: dict[str, Any], ai_error: str | None = None) -> str:
    summary = record.get("json_summary") or {}
    scoring = record.get("scoring") or {}
    criteria = scoring.get("criteria") or {}
    target_relevance = criteria.get("target_relevance") or {}

    lines = ["OpenRouter 응답을 받지 못해 로컬 요약으로 응답합니다."]
    if ai_error:
        lines.extend(["", f"OpenRouter 상태: {ai_error}"])

    lines.extend([
        "",
        f"- Asset: {summary.get('asset_name', '-')}",
        f"- Company: {summary.get('company', '-')}",
        f"- Target: {summary.get('target', '-')}",
        f"- Theme: {summary.get('theme', '-')} / Cluster: {summary.get('cluster', '-')}",
        f"- Total score: {scoring.get('total_score', '-')} / {scoring.get('max_score', '-')}",
        f"- Target relevance reason: {target_relevance.get('main_line_summary') or target_relevance.get('reason', '-')}",
    ])
    return "\n".join(lines)


def concise_ai_error(ai_error: str | None) -> str:
    if not ai_error:
        return ""
    lowered = ai_error.lower()
    if "free-models-per-day" in lowered:
        return "OpenRouter free model 일일 한도를 초과했습니다. OpenRouter에 5 credits 이상을 추가하거나 유료/개인 provider key 모델로 바꾸면 다시 실제 AI 답변을 받을 수 있습니다."
    if "rate-limited upstream" in lowered or "temporarily rate-limited" in lowered:
        return "OpenRouter upstream provider가 일시적으로 rate limit 상태입니다. 잠시 후 재시도하거나 다른 모델을 지정해 주세요."
    if "api_key" in lowered or "401" in lowered:
        return "OpenRouter API key 설정 또는 권한을 확인해 주세요."
    return ai_error[:350]


def sse_event(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def chunk_text(text: str, size: int = 90) -> list[str]:
    if not text:
        return []
    return [text[index : index + size] for index in range(0, len(text), size)]


def stream_openrouter_chat(
    record: dict[str, Any],
    message: str,
    dashboard_context: str = "",
) -> tuple[Any, list[dict[str, str | int]], str | None]:
    dashboard_context = (dashboard_context or "")[:CHAT_DASHBOARD_CONTEXT_LIMIT]
    wiki_snippets = search_wiki_notes(build_wiki_search_query(record, message, dashboard_context))
    wiki_context = format_wiki_context(wiki_snippets)

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return iter(()), wiki_snippets, "OPENROUTER_API_KEY is not set."

    base_payload = {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an internal AI assistant for SKBP Pipeline Finder. "
                    "Answer in Korean unless the user asks otherwise. "
                    "Use only the provided compact JSON, dashboard rows, and retrieved SKBP wiki notes. "
                    "Never use markdown tables. Use short bullet sections only. "
                    "Cite wiki note filenames or evidence URLs when available. "
                    "If evidence is missing, say what is uncertain and what to verify next. "
                    "Keep the answer concise enough to fit in a chat panel, usually under 450 words."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Compact pipeline JSON context:\n"
                    f"{compact_chat_context(record)}\n\n"
                    "Dashboard visible rows context:\n"
                    f"{dashboard_context or 'No dashboard context provided.'}\n\n"
                    "Retrieved SKBP wiki notes:\n"
                    f"{wiki_context}\n\n"
                    "User question:\n"
                    f"{message}"
                ),
            },
        ],
        "temperature": 0.2,
        "max_tokens": OPENROUTER_MAX_TOKENS,
        "stream": True,
    }

    errors: list[str] = []
    for model in openrouter_models_to_try():
        payload = {**base_payload, "model": model}
        request = urllib.request.Request(
            OPENROUTER_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://127.0.0.1:8000"),
                "X-Title": os.getenv("OPENROUTER_APP_TITLE", "SKBP Pipeline Finder"),
            },
            method="POST",
        )
        try:
            response = urllib.request.urlopen(request, timeout=120)
            return response, wiki_snippets, None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            errors.append(f"{model}: HTTP {exc.code} - {summarize_openrouter_error(detail)}")
            if exc.code in {401, 402, 403} or "free-models-per-day" in detail.lower():
                break
        except Exception as exc:
            errors.append(f"{model}: request failed - {exc}")

    return iter(()), wiki_snippets, " / ".join(errors[:4]) or "OpenRouter returned no usable response."


def local_agentic_reply(
    record: dict[str, Any],
    message: str,
    dashboard_context: str,
    wiki_sources: list[dict[str, str | int]],
    ai_error: str | None,
) -> str:
    summary = record.get("json_summary") or {}
    scoring = record.get("scoring") or {}
    criteria = scoring.get("criteria") or {}
    platform = criteria.get("platform_attractiveness") or {}
    target = criteria.get("target_relevance") or {}
    data = criteria.get("data_maturity") or {}
    market = criteria.get("marketability") or {}
    source_lines = [
        f"- {source.get('path')} (match score {source.get('score')})"
        for source in wiki_sources[:4]
    ]
    visible_lines = [
        line.strip()
        for line in (dashboard_context or "").splitlines()
        if line.strip().startswith("-")
    ][:5]

    lines = [
        "OpenRouter 실제 답변을 받지 못해, 로컬 JSON + wiki 검색 결과로 우선 답변합니다.",
    ]
    error = concise_ai_error(ai_error)
    if error:
        lines.extend(["", f"상태: {error}"])

    lines.extend([
        "",
        "우선 후보",
        f"- {summary.get('asset_name', '-')} ({summary.get('company', '-')})",
        f"- Theme / Cluster: {summary.get('theme', '-')} / {summary.get('cluster', '-')}",
        f"- Target: {summary.get('target', '-')}",
        f"- Total score: {scoring.get('total_score', '-')} / {scoring.get('max_score', '-')}",
        "",
        "판단 근거",
        f"- Target Relevance {target.get('score', '-')}: {target.get('main_line_summary') or target.get('reason', '-')}",
        f"- Platform {platform.get('score', '-')}: {platform.get('main_line_summary') or platform.get('reason', '-')}",
        f"- Data Maturity {data.get('score', '-')}: {data.get('main_line_summary') or data.get('reason', '-')}",
        f"- Marketability {market.get('score', '-')}: {market.get('main_line_summary') or market.get('reason', '-')}",
    ])

    if visible_lines:
        lines.extend(["", "대시보드 비교 후보", *visible_lines])
    if source_lines:
        lines.extend(["", "검색된 wiki 근거", *source_lines])

    lines.extend([
        "",
        "다음 확인 포인트",
        "- 임상 efficacy readout, 권리/라이선스 범위, 경쟁 asset 대비 차별성, marketability 산식의 근거 URL을 추가 확인하는 것이 좋습니다.",
    ])
    return "\n".join(lines)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(ROOT / "index.html")


@app.get("/detail")
def detail() -> FileResponse:
    return FileResponse(ROOT / "detail.html")


@app.get("/wiki-view")
def wiki_view() -> FileResponse:
    return FileResponse(ROOT / "wiki_view.html")


@app.get("/api/wiki-note")
def get_wiki_note(path: str) -> dict[str, Any]:
    normalized = path.replace("\\", "/").lstrip("/")
    target = (WIKI_DIR / normalized).resolve()
    wiki_root = WIKI_DIR.resolve()
    if not str(target).startswith(str(wiki_root)) or target.suffix.lower() != ".md":
        raise HTTPException(status_code=400, detail="Invalid wiki note path.")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail=f"Wiki note not found: {normalized}")
    return {
        "path": target.relative_to(wiki_root).as_posix(),
        "title": target.stem.replace("_", " "),
        "markdown": target.read_text(encoding="utf-8", errors="replace"),
    }


@app.get("/api/records")
def get_records() -> dict[str, Any]:
    records = load_records()
    return {
        "records": records,
        "data_file": str(DATA_FILE.relative_to(ROOT)).replace("\\", "/"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/records/{record_id}/apply-ai-revision")
async def apply_ai_revision_to_record(record_id: str, request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from None

    answer_markdown = (payload.get("answer_markdown") or "").strip()
    instruction = (payload.get("instruction") or "").strip()
    if not answer_markdown:
        raise HTTPException(status_code=400, detail="answer_markdown is required.")

    records = load_records()
    for index, record in enumerate(records):
        if record_key(record) != record_id:
            continue

        result = build_ai_revision_update(record, answer_markdown, instruction)
        updated_record = result["record"]
        validate_records_for_save([updated_record])
        records[index] = updated_record
        save_records(records)
        exports = run_markdown_exports()
        return {
            "ok": True,
            "record": updated_record,
            "record_id": record_key(updated_record),
            "updated_previous_id": record_id,
            "changes": result["changes"],
            "total": len(records),
            "exports": exports,
        }

    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


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


@app.get("/api/category-synonyms")
def get_category_synonyms() -> Any:
    return read_json(CATEGORY_SYNONYMS_FILE)


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
async def chat_with_record_openrouter(request: Request) -> dict[str, Any]:
    payload = await request.json()
    record_id = payload.get("record_id")
    message = (payload.get("message") or "").strip()
    dashboard_context = (payload.get("dashboard_context") or "").strip()
    allow_draft = bool(payload.get("allow_draft", True))

    if not record_id or not message:
        raise HTTPException(status_code=400, detail="record_id and message are required.")

    records = load_records()
    record = next((item for item in records if record_key(item) == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")

    draft = build_ai_draft(record, message) if allow_draft else None
    reply, ai_error, wiki_sources = call_openrouter_chat(record, message, dashboard_context)
    if not reply:
        reply = local_agentic_reply(record, message, dashboard_context, wiki_sources, ai_error)
        ai_error = None
    draft_response = draft
    if draft_response:
        reply += "\n\n수정 초안도 함께 만들었습니다. 화면의 '초안 적용' 버튼을 누르면 이 record JSON에 저장됩니다."
    draft = None
    if ai_error:
            reply += f"\n\nOpenRouter 상태: {ai_error}"

    if draft:
        reply += "\n\n수정 초안도 함께 만들었습니다. 화면의 '초안 적용' 버튼을 누르면 이 record JSON에 저장됩니다."

    return {
        "reply": reply,
        "draft_record": draft_response["record"] if draft_response else None,
        "draft_changes": draft_response["changes"] if draft_response else [],
        "sources": wiki_sources,
    }


@app.post("/api/chat/stream")
async def chat_with_record_stream(request: Request) -> StreamingResponse:
    payload = await request.json()
    record_id = payload.get("record_id")
    message = (payload.get("message") or "").strip()
    dashboard_context = (payload.get("dashboard_context") or "").strip()

    if not record_id or not message:
        raise HTTPException(status_code=400, detail="record_id and message are required.")

    records = load_records()
    record = next((item for item in records if record_key(item) == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")

    def event_generator():
        stream, wiki_sources, ai_error = stream_openrouter_chat(record, message, dashboard_context)
        yield sse_event("sources", wiki_sources)
        yield sse_event("status", {"message": "관련 JSON과 wiki note를 검색했습니다. AI 답변을 생성합니다."})

        if ai_error:
            fallback = local_agentic_reply(record, message, dashboard_context, wiki_sources, ai_error)
            for chunk in chunk_text(fallback):
                yield sse_event("delta", {"text": chunk})
            yield sse_event("done", {"fallback": True})
            return

        try:
            for raw_line in stream:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line or not line.startswith("data:"):
                    continue
                data_text = line.removeprefix("data:").strip()
                if data_text == "[DONE]":
                    break
                try:
                    data = json.loads(data_text)
                except json.JSONDecodeError:
                    continue
                delta = data.get("choices", [{}])[0].get("delta", {}).get("content")
                if delta:
                    yield sse_event("delta", {"text": delta})
        except Exception as exc:
            fallback = local_agentic_reply(record, message, dashboard_context, wiki_sources, str(exc))
            for chunk in chunk_text(fallback):
                yield sse_event("delta", {"text": chunk})
            yield sse_event("done", {"fallback": True})
            return
        finally:
            close = getattr(stream, "close", None)
            if callable(close):
                close()

        yield sse_event("done", {"fallback": False})

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/chat/mock")
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
