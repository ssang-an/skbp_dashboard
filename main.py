from __future__ import annotations

import json
import copy
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import subprocess
import sys
import uuid
import zipfile
from xml.etree import ElementTree

import requests
import urllib3
import document_pipeline
from openpyxl import load_workbook
from pypdf import PdfReader
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT = Path(__file__).resolve().parent
JSON_DIR = ROOT / "json"
DATA_FILE = JSON_DIR / "pipeline-records.json"
SAMPLE_FILE = JSON_DIR / "drug-valuations.sample.json"
SCHEMA_FILE = JSON_DIR / "drug-valuation.schema.json"
OBSIDIAN_DIR = ROOT / "obsidian"
WIKI_DIR = ROOT / "skbp_pipeline_wiki"
ATTACHMENTS_DIR = ROOT / "attachments"
SCORING_CRITERIA_VERSION = "3.2"
TRIAGE_CRITERIA_VERSION = "3.1"
SCORING_CRITERIA_FULL_MD = ROOT / "config" / "scoring_criteria" / "v3_2_full.md"
SCORING_CRITERIA_DISPLAY_MD = ROOT / "config" / "scoring_criteria" / "v3_2_display.md"
CATEGORY_SYNONYMS_FILE = ROOT / "config" / "category-synonyms.json"
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
CHAT_WIKI_AGENT_SEARCH_TOP_K = 8
CHAT_WIKI_LINK_EXPANSION_LIMIT = 16


class RequestsLineStream:
    def __init__(self, response: requests.Response):
        self.response = response

    def __iter__(self):
        return self.response.iter_lines()

    def close(self) -> None:
        self.response.close()


def openrouter_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://127.0.0.1:8000"),
        "X-Title": os.getenv("OPENROUTER_APP_TITLE", "SKBP Pipeline Finder"),
    }


def post_openrouter(payload: dict[str, Any], api_key: str, *, stream: bool = False) -> requests.Response:
    response = requests.post(
        document_pipeline.openrouter_chat_url(),
        json=payload,
        headers=openrouter_headers(api_key),
        timeout=120,
        stream=stream,
        verify=False,
    )
    response.raise_for_status()
    return response


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

OPENROUTER_MAX_TOKENS = int(os.getenv("OPENROUTER_MAX_TOKENS", "1200"))

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
MARKETABILITY_COMMERCIAL_RATIONALE_STATUS_ALLOWED_VALUES = {
    "evidence_based",
    "assumption_based",
    "assumption_based_scenario",
    "insufficient_evidence",
    "established",
    "not_established",
}

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

ATTACHMENT_ALLOWED_EXTENSIONS = {".ppt", ".pptx", ".doc", ".docx", ".pdf", ".txt", ".xls", ".xlsx"}
ATTACHMENT_MAX_BYTES = 30 * 1024 * 1024  # 30 MB
ATTACHMENT_PREVIEW_TEXT_LIMIT = 180_000

# Temporary v1 criteria for the detail-page qualitative review panel.
# Keep in sync with config/qualitative_review_criteria.md and
# src/detail.js's qualitativeReviewCriteria.
QUALITATIVE_REVIEW_CRITERIA = {
    "efficacy": {
        "label": "Efficacy",
        "description": "% Reversal(정상군 대비 회복율) 및 SoC 대비 통계적 유의성(p-value) 있는 개선 우위 확인",
    },
    "commercial_appeal": {
        "label": "Commercial",
        "description": "L-IN / L-OUT 파트너사 관점에서의 TPP 매력도, Unmet Need 충족 및 시장 차별성 평가",
    },
    "execution_risk": {
        "label": "Dev. & Partnership Risk",
        "description": "임상/안전성/CMC 진행 시 주요 리스크, 불확실성 및 Due Diligence(DD) 추가 확인 필요 사항",
    },
}

app = FastAPI(title="SKBP Pipeline Dashboard")
app.mount("/src", StaticFiles(directory=ROOT / "src"), name="src")
app.mount("/json", StaticFiles(directory=JSON_DIR), name="json")
WIKI_DIR.mkdir(exist_ok=True)
ATTACHMENTS_DIR.mkdir(exist_ok=True)
if OBSIDIAN_DIR.exists():
    app.mount("/obsidian", StaticFiles(directory=OBSIDIAN_DIR), name="obsidian")
app.mount("/wiki", StaticFiles(directory=WIKI_DIR), name="wiki")
app.mount("/attachments", StaticFiles(directory=ATTACHMENTS_DIR), name="attachments")


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

    if "main_line_summary" not in criterion and "reason" not in criterion:
        validation_error(f"{criterion_id}.main_line_summary or {criterion_id}.reason is required.")

    if "why_not_higher" not in criterion:
        validation_error(f"{criterion_id}.why_not_higher is required.")

    require_list_field(criterion, criterion_id, "uncertain_points")

    for field in ["what_was_checked", "evidence_trail", "evidence_sources", "source_ids"]:
        if field in criterion and not isinstance(criterion.get(field), list):
            validation_error(f"{criterion_id}.{field} must be an array when provided.")


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
            f"marketability.calculation.commercial_rationale_status must be one of: {', '.join(sorted(MARKETABILITY_COMMERCIAL_RATIONALE_STATUS_ALLOWED_VALUES))}."
        )

    step_a = calculation.get("A_targetable_addressable_patient") or {}
    step_b = calculation.get("B_unrisked_peak_sales") or {}
    step_c = calculation.get("C_obtainable_peak_sales") or {}
    if not all(isinstance(step, dict) for step in [step_a, step_b, step_c]):
        validation_error("marketability.calculation A/B/C steps must be objects.")

    if status in {"insufficient_evidence", "not_established"}:
        if criterion.get("score") != 0:
            validation_error("marketability.score must be 0 when commercial_rationale_status is insufficient_evidence or not_established.")
        if is_blank(calculation.get("commercial_rationale_failure_reason")):
            validation_error("marketability.commercial_rationale_failure_reason is required when commercial rationale is insufficient_evidence or not_established.")
        for path, value in [
            ("A_targetable_addressable_patient.targetable_addressable_patient", step_a.get("targetable_addressable_patient")),
            ("B_unrisked_peak_sales.unrisked_peak_sales", step_b.get("unrisked_peak_sales")),
            ("C_obtainable_peak_sales.obtainable_peak_sales", step_c.get("obtainable_peak_sales")),
        ]:
            if value is not None:
                validation_error(
                    f"marketability.calculation.{path} must be null when commercial rationale is insufficient_evidence or not_established."
                )
    else:
        if status in {"assumption_based", "assumption_based_scenario"} and is_blank(
            calculation.get("commercial_rationale_basis")
        ):
            validation_error("marketability.calculation.commercial_rationale_basis is required when status is assumption_based_scenario.")
        for path, value in [
            ("A_targetable_addressable_patient.targetable_addressable_patient", step_a.get("targetable_addressable_patient")),
            ("B_unrisked_peak_sales.unrisked_peak_sales", step_b.get("unrisked_peak_sales")),
            ("C_obtainable_peak_sales.obtainable_peak_sales", step_c.get("obtainable_peak_sales")),
        ]:
            if is_blank(value):
                validation_error(f"marketability.calculation.{path} is required when commercial rationale is established.")


def validate_stage_specific_fields(criteria: dict[str, Any]) -> None:
    # v3.2 Balanced still benefits from these fields, but the dashboard can render
    # and compare records without requiring them at save time.
    return


def validate_records_for_save(records: list[dict[str, Any]]) -> None:
    for index, record in enumerate(records):
        ensure_meta_defaults(record)
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


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


def ensure_meta_defaults(record: dict[str, Any]) -> None:
    meta = record.setdefault("meta", {})
    if not meta.get("generated_at"):
        meta["generated_at"] = datetime.now(timezone.utc).date().isoformat()


def append_edit_history(
    record: dict[str, Any],
    *,
    source: str,
    actor_ip: str,
    actor_name: str = "",
    field: str = "record",
    previous_value: Any = None,
    new_value: Any = None,
    old_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Stamp a record's meta with a human/dashboard edit event.

    The reviewer-entered name/ID is preferred when supplied; the requester IP is
    retained as a technical audit fallback until SSO is available.
    """
    meta = record.setdefault("meta", {})
    history = meta.get("edit_history")
    if not isinstance(history, list):
        history = list(((old_meta or {}).get("edit_history")) or [])
    changed_at = datetime.now(timezone.utc).isoformat()
    entry = {
        "changed_at": changed_at,
        "actor_ip": actor_ip,
        "actor_name": actor_name,
        "source": source,
        "field": field,
        "previous_value": previous_value,
        "new_value": new_value,
    }
    history.append(entry)
    meta["edit_history"] = history[-200:]
    meta["last_edited_at"] = changed_at
    meta["last_edited_by"] = actor_name or actor_ip
    return entry


def safe_note_name(value: Any, fallback: str = "Untitled") -> str:
    text = str(value or fallback).strip()
    text = re.sub(r'[<>:"/\\\\|?*]', "-", text)
    text = re.sub(r"\s+", " ", text).strip(" .")
    return text or fallback


def resolve_attachment_url(stored_path: str) -> Path:
    if not stored_path.startswith("/attachments/"):
        raise HTTPException(status_code=404, detail="Attachment file path is invalid.")
    relative_path = Path(stored_path[len("/attachments/"):])
    resolved = (ATTACHMENTS_DIR / relative_path).resolve()
    attachments_root = ATTACHMENTS_DIR.resolve()
    if attachments_root != resolved and attachments_root not in resolved.parents:
        raise HTTPException(status_code=404, detail="Attachment file path is invalid.")
    if not resolved.is_file():
        raise HTTPException(status_code=404, detail="Attachment file was not found on disk.")
    return resolved


def resolve_attachment_path(attachment: dict[str, Any]) -> Path:
    return resolve_attachment_url(str(attachment.get("stored_path") or ""))


def attachment_url_for_path(file_path: Path) -> str:
    resolved = file_path.resolve()
    attachments_root = ATTACHMENTS_DIR.resolve()
    if attachments_root != resolved and attachments_root not in resolved.parents:
        raise ValueError("Derived attachment path is outside the attachments directory.")
    return "/attachments/" + resolved.relative_to(attachments_root).as_posix()


def filter3_criteria_text() -> str:
    criteria_path = ROOT / "config" / "oi_partnership_criteria.md"
    if not criteria_path.is_file():
        return "Use the current Tab3 OI Partnership criteria configured by the application."
    return criteria_path.read_text(encoding="utf-8")[:20_000]


def cached_pdf_parser_result(records: list[dict[str, Any]], file_sha256: str) -> dict[str, Any] | None:
    if not file_sha256:
        return None
    for record in records:
        attachments = (record.get("meta") or {}).get("attachments")
        if not isinstance(attachments, list):
            continue
        for attachment in attachments:
            if not isinstance(attachment, dict):
                continue
            processing = attachment.get("document_processing")
            if not isinstance(processing, dict) or processing.get("file_sha256") != file_sha256:
                continue
            parser = processing.get("parser")
            if isinstance(parser, dict) and parser.get("status") == "completed" and parser.get("parsed_text"):
                return copy.deepcopy(parser)
    return None


def process_attachment_document(
    records: list[dict[str, Any]],
    attachment: dict[str, Any],
    file_path: Path,
) -> dict[str, Any]:
    file_sha256 = document_pipeline.sha256_file(file_path)
    cached_parser = cached_pdf_parser_result(records, file_sha256)
    processing = document_pipeline.process_document(
        file_path,
        str(attachment.get("filename") or file_path.name),
        filter3_criteria=filter3_criteria_text(),
        cached_parser=cached_parser,
    )
    conversion = processing.get("viewer_conversion")
    if isinstance(conversion, dict) and conversion.get("pdf_path"):
        preview_path = Path(str(conversion["pdf_path"]))
        attachment["preview_pdf_path"] = attachment_url_for_path(preview_path)
        conversion["pdf_path"] = None
    attachment["document_processing"] = processing
    attachment["processing_status"] = str(processing.get("status") or "failed")
    attachment["processing_error"] = str(
        ((processing.get("deepseek_analysis") or {}).get("error"))
        or ((processing.get("parser") or {}).get("error"))
        or ""
    )[:1000]
    return processing


def openxml_text_preview(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix == ".pptx":
        member_pattern = re.compile(r"^ppt/slides/slide(\d+)\.xml$")
    elif suffix == ".docx":
        member_pattern = re.compile(r"^word/document\.xml$")
    else:
        return ""

    sections: list[str] = []
    with zipfile.ZipFile(file_path) as archive:
        members: list[tuple[int, str]] = []
        for name in archive.namelist():
            match = member_pattern.match(name)
            if not match:
                continue
            order = int(match.group(1)) if match.groups() else 1
            members.append((order, name))
        for order, name in sorted(members):
            root = ElementTree.fromstring(archive.read(name))
            text_nodes = [
                str(node.text or "").strip()
                for node in root.iter()
                if node.tag.endswith("}t") and str(node.text or "").strip()
            ]
            if not text_nodes:
                continue
            heading = f"[Slide {order}]" if suffix == ".pptx" else "[Document]"
            sections.append(f"{heading}\n" + "\n".join(text_nodes))
    return "\n\n".join(sections)[:ATTACHMENT_PREVIEW_TEXT_LIMIT]


def xlsx_text_preview(file_path: Path) -> str:
    workbook = load_workbook(file_path, read_only=True, data_only=True)
    try:
        sections: list[str] = []
        for sheet in workbook.worksheets:
            rows_text = []
            for row in sheet.iter_rows(values_only=True):
                cells = [str(cell).strip() for cell in row if cell is not None and str(cell).strip()]
                if cells:
                    rows_text.append(" | ".join(cells))
            if rows_text:
                sections.append(f"[Sheet {sheet.title}]\n" + "\n".join(rows_text))
        return "\n\n".join(sections)[:ATTACHMENT_PREVIEW_TEXT_LIMIT]
    finally:
        workbook.close()


def pdf_text_preview(file_path: Path) -> str:
    reader = PdfReader(str(file_path))
    pages_text = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages_text)[:ATTACHMENT_PREVIEW_TEXT_LIMIT]


def extract_attachment_text(attachment: dict[str, Any]) -> str:
    processing = attachment.get("document_processing")
    if isinstance(processing, dict):
        extraction = processing.get("extraction")
        if isinstance(extraction, dict) and extraction.get("parsed_text"):
            return str(extraction["parsed_text"])[:ATTACHMENT_PREVIEW_TEXT_LIMIT]
    try:
        file_path = resolve_attachment_path(attachment)
    except HTTPException:
        return ""
    suffix = file_path.suffix.lower()
    try:
        if suffix == ".txt":
            return file_path.read_text(encoding="utf-8", errors="replace")[:ATTACHMENT_PREVIEW_TEXT_LIMIT]
        if suffix in {".pptx", ".docx"}:
            return openxml_text_preview(file_path)
        if suffix == ".xlsx":
            return xlsx_text_preview(file_path)
        if suffix == ".pdf":
            return pdf_text_preview(file_path)
    except Exception:
        # Legacy/corrupt/unreadable files fall back to "no extractable text"
        # rather than failing the request that triggered detection.
        return ""
    return ""


IN_VIVO_PATTERN = re.compile(r"in[\s\-]?vivo", re.IGNORECASE)
IN_VITRO_PATTERN = re.compile(r"in[\s\-]?vitro", re.IGNORECASE)
EVIDENCE_CONTEXT_WINDOW = 140
EVIDENCE_NEGATION_CUES = re.compile(
    r"\b(no|not|without|lack(?:s|ing)?\s+of|absence\s+of|not\s+yet|not\s+disclosed|not\s+available|"
    r"not\s+reported|not\s+confirmed|not\s+demonstrated|failed|failure|negative|inconclusive|pending)\b|"
    r"(없음|미확인|확인되지|실패|음성|불명확|미공개|진행\s*중)",
    re.IGNORECASE,
)
EVIDENCE_POSITIVE_CUES = re.compile(
    r"\b(demonstrat(?:e|ed|es|ing)|show(?:ed|s|n)?|confirm(?:ed|s)?|validated?|positive|"
    r"efficacy|effective|significant(?:ly)?|improv(?:e|ed|ement)|reduc(?:e|ed|tion)|"
    r"activity|active|poten(?:t|cy)|proof[\s\-]?of[\s\-]?concept|dose[\s\-]?dependent)\b|"
    r"(유효성|효과|효능|활성|입증|확인|개선|감소|억제|양성|통계적\s*유의)",
    re.IGNORECASE,
)
ADMET_COMPLETED_PATTERN = re.compile(r"\bcompleted\b", re.IGNORECASE)
ADMET_TOTAL_ITEMS = 50
OI_PARTNERSHIP_CRITERIA_VERSION = "1.0"
OI_PARTNERSHIP_TYPES = {"value_up", "joint_research", "investment", "n_a", "unknown"}
OI_PARTNERSHIP_LABELS = {
    "investment": "투자",
    "value_up": "Value Up",
    "joint_research": "공동 연구",
    "n_a": "N/A",
    "unknown": "Unknown",
}
OI_UNKNOWN_VALUES = {"", "-", "unknown", "n/a", "na", "not available", "not disclosed", "미확인", "불명"}
OI_TARGET_INDICATION_PATTERNS = [
    ("Alzheimer's Disease", re.compile(r"\balzheimer(?:'s)?(?:\s+disease)?\b|(?<![a-z])ad(?![a-z])", re.IGNORECASE)),
    ("Parkinson's Disease", re.compile(r"\bparkinson(?:'s)?(?:\s+disease)?\b|(?<![a-z])pd(?![a-z])", re.IGNORECASE)),
    ("Amyotrophic Lateral Sclerosis", re.compile(r"\bamyotrophic\s+lateral\s+sclerosis\b|(?<![a-z])als(?![a-z])", re.IGNORECASE)),
    ("Multiple Sclerosis", re.compile(r"\bmultiple\s+sclerosis\b|(?<![a-z])ms(?![a-z])", re.IGNORECASE)),
    ("Neuropathic Pain", re.compile(r"\bneuropathic\s+pain\b|\bneuralgia\b", re.IGNORECASE)),
    ("Epilepsy", re.compile(r"\bepilep(?:sy|tic)\b|\bseizure\s+disorders?\b", re.IGNORECASE)),
]
OI_SMALL_MOLECULE_PATTERN = re.compile(r"\bsmall[\s\-]?molecule\b", re.IGNORECASE)
OI_NON_SMALL_MOLECULE_PATTERN = re.compile(
    r"\b(biologic|antibod(?:y|ies)|peptide|protein|gene[\s\-]?therapy|cell[\s\-]?therapy|"
    r"rna(?:\s+therapy)?|aso|siRNA|mRNA|vaccine|oligonucleotide|monoclonal)\b",
    re.IGNORECASE,
)
OI_IND_ENABLING_PATTERN = re.compile(r"\bind[\s\-]?enabl(?:ing|ement)\b", re.IGNORECASE)


def classify_evidence_presence(text: str, pattern: re.Pattern[str]) -> str:
    """O = explicit positive result, X = explicit negative result, N/A = absent or outcome unclear."""
    matches = list(pattern.finditer(text))
    if not matches:
        return "N/A"
    negative_found = False
    for match in matches:
        window = text[
            max(0, match.start() - EVIDENCE_CONTEXT_WINDOW):
            min(len(text), match.end() + EVIDENCE_CONTEXT_WINDOW)
        ]
        if EVIDENCE_NEGATION_CUES.search(window):
            negative_found = True
            continue
        if EVIDENCE_POSITIVE_CUES.search(window):
            return "O"
    return "X" if negative_found else "N/A"


def count_admet_completed(attachments: list[Any]) -> int | None:
    admet_attachments = [
        item
        for item in attachments
        if isinstance(item, dict) and "admet" in str(item.get("filename") or "").lower()
    ]
    if not admet_attachments:
        return None
    total = sum(len(ADMET_COMPLETED_PATTERN.findall(extract_attachment_text(item))) for item in admet_attachments)
    return min(total, ADMET_TOTAL_ITEMS)


def attachment_filter3_analyses(record: dict[str, Any]) -> list[dict[str, Any]]:
    attachments = (record.get("meta") or {}).get("attachments")
    if not isinstance(attachments, list):
        return []
    analyses = []
    for attachment in attachments:
        if not isinstance(attachment, dict):
            continue
        processing = attachment.get("document_processing")
        deepseek = processing.get("deepseek_analysis") if isinstance(processing, dict) else None
        result = deepseek.get("result") if isinstance(deepseek, dict) else None
        if not isinstance(result, dict) or deepseek.get("status") != "completed":
            continue
        analyses.append(
            {
                "attachment_id": str(attachment.get("id") or ""),
                "filename": str(attachment.get("filename") or "업로드 파일"),
                "document_id": str(processing.get("document_id") or ""),
                "extraction_method": str((processing.get("extraction") or {}).get("method") or ""),
                "result": result,
            }
        )
    return analyses


def aggregate_document_verdict(analyses: list[dict[str, Any]], criterion: str) -> str:
    verdicts = []
    for analysis in analyses:
        judgment = (analysis.get("result") or {}).get(criterion)
        if isinstance(judgment, dict):
            verdict = str(judgment.get("verdict") or "unknown").lower()
            if verdict in {"true", "false", "unknown"}:
                verdicts.append(verdict)
    if "true" in verdicts:
        return "true"
    if "false" in verdicts:
        return "false"
    return "unknown"


def auto_detect_evidence_fields(record: dict[str, Any]) -> dict[str, Any]:
    """Prefer DeepSeek document judgments; fall back to conservative keyword checks."""
    report_text = str((record.get("source_report") or {}).get("raw_markdown") or "")
    attachments = record.get("meta", {}).get("attachments")
    attachments = attachments if isinstance(attachments, list) else []
    analyses = attachment_filter3_analyses(record)
    if analyses:
        in_vivo_verdict = aggregate_document_verdict(analyses, "in_vivo_efficacy")
        in_vitro_verdict = aggregate_document_verdict(analyses, "in_vitro_efficacy")
        admet_counts = [
            (analysis.get("result") or {}).get("admet_completed_count")
            for analysis in analyses
        ]
        numeric_admet_counts = [
            value
            for value in admet_counts
            if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= ADMET_TOTAL_ITEMS
        ]
        return {
            "in_vivo_status": {"true": "O", "false": "X"}.get(in_vivo_verdict, "N/A"),
            "in_vitro_status": {"true": "O", "false": "X"}.get(in_vitro_verdict, "N/A"),
            "admet_completed": max(numeric_admet_counts) if numeric_admet_counts else None,
            "document_analyses": analyses,
        }
    attachment_texts = [extract_attachment_text(item) for item in attachments if isinstance(item, dict)]
    combined_text = "\n\n".join([report_text, *attachment_texts])
    return {
        "in_vivo_status": classify_evidence_presence(combined_text, IN_VIVO_PATTERN),
        "in_vitro_status": classify_evidence_presence(combined_text, IN_VITRO_PATTERN),
        "admet_completed": count_admet_completed(attachments),
        "document_analyses": [],
    }


def apply_auto_detected_evidence(focus: dict[str, Any], record: dict[str, Any], *, force: bool = False) -> None:
    detected = auto_detect_evidence_fields(record)
    for field_key in ("in_vivo_status", "in_vitro_status", "admet_completed"):
        source_key = f"{field_key}_source"
        if not force and focus.get(source_key) == "manual":
            continue
        focus[field_key] = detected[field_key]
        focus[source_key] = "deepseek" if detected.get("document_analyses") else "auto"
    focus["filter3_document_analyses"] = detected.get("document_analyses") or []
    focus["filter3_document_analysis_updated_at"] = datetime.now(timezone.utc).isoformat()


def oi_known_text(value: Any) -> str:
    text = str(value or "").strip()
    return "" if text.lower() in OI_UNKNOWN_VALUES else text


def oi_labeled_value(text: str, labels: list[str]) -> str:
    if not text:
        return ""
    label_pattern = "|".join(re.escape(label) for label in labels)
    match = re.search(
        rf"(?im)^\s*(?:[-*]\s*)?(?:{label_pattern})\s*[:|]\s*([^\n|]{{1,120}})",
        text,
    )
    return oi_known_text(match.group(1)) if match else ""


def oi_text_sources(record: dict[str, Any]) -> list[tuple[str, str]]:
    meta = record.get("meta") or {}
    report_name = str(meta.get("output_filename_base") or "원문 리포트")
    sources: list[tuple[str, str]] = []
    raw_markdown = str((record.get("source_report") or {}).get("raw_markdown") or "")
    if raw_markdown:
        sources.append((f"Tab2 원문 리포트: {report_name}", raw_markdown))
    attachments = meta.get("attachments")
    if isinstance(attachments, list):
        for attachment in attachments:
            if not isinstance(attachment, dict):
                continue
            filename = str(attachment.get("filename") or "업로드 파일")
            extracted = extract_attachment_text(attachment)
            if extracted:
                sources.append((f"사용자 업로드 파일: {filename}", extracted))
    return sources


def oi_match_target_indication(value: str) -> str:
    for canonical, pattern in OI_TARGET_INDICATION_PATTERNS:
        if pattern.search(value):
            return canonical
    return ""


def oi_indication_state(
    record: dict[str, Any],
    text_sources: list[tuple[str, str]],
) -> tuple[str, str, str]:
    table = record.get("structured_table") or {}
    summary = record.get("json_summary") or {}
    structured_values = [
        table.get("main_indication"),
        table.get("primary_indication"),
        table.get("indication"),
        summary.get("main_indication"),
        summary.get("indication"),
    ]
    known_values = [oi_known_text(value) for value in structured_values if oi_known_text(value)]
    if known_values:
        combined = " / ".join(known_values)
        target = oi_match_target_indication(combined)
        return ("target", target, "Tab3에 이미 입력된 구조화 데이터") if target else (
            "non_target",
            combined,
            "Tab3에 이미 입력된 구조화 데이터",
        )
    for source_label, text in text_sources:
        value = oi_labeled_value(text, ["main indication", "indication", "적응증", "대상 질환"])
        if not value:
            continue
        target = oi_match_target_indication(value)
        return ("target", target, source_label) if target else ("non_target", value, source_label)
    return "unknown", "", ""


def oi_modality_state(
    record: dict[str, Any],
    text_sources: list[tuple[str, str]],
) -> tuple[str, str, str]:
    table = record.get("structured_table") or {}
    summary = record.get("json_summary") or {}
    for raw_value in [table.get("modality_platform"), summary.get("modality_platform"), summary.get("modality")]:
        value = oi_known_text(raw_value)
        if not value:
            continue
        if OI_SMALL_MOLECULE_PATTERN.search(value):
            return "small_molecule", value, "Tab3에 이미 입력된 구조화 데이터"
        if OI_NON_SMALL_MOLECULE_PATTERN.search(value):
            return "non_small_molecule", value, "Tab3에 이미 입력된 구조화 데이터"
    for source_label, text in text_sources:
        value = oi_labeled_value(text, ["modality", "modality platform", "drug type", "therapeutic type", "모달리티", "제형"])
        if OI_SMALL_MOLECULE_PATTERN.search(value):
            return "small_molecule", value, source_label
        if OI_NON_SMALL_MOLECULE_PATTERN.search(value):
            return "non_small_molecule", value, source_label
    return "unknown", "", ""


def oi_stage_state(
    record: dict[str, Any],
    text_sources: list[tuple[str, str]],
) -> tuple[str, str, str]:
    table = record.get("structured_table") or {}
    summary = record.get("json_summary") or {}
    for raw_value in [table.get("development_stage"), summary.get("development_stage")]:
        value = oi_known_text(raw_value)
        if value:
            return (
                "ind_enabling" if OI_IND_ENABLING_PATTERN.search(value) else "other",
                value,
                "Tab3에 이미 입력된 구조화 데이터",
            )
    for source_label, text in text_sources:
        value = oi_labeled_value(text, ["development stage", "stage", "개발 단계", "개발단계"])
        if value:
            return ("ind_enabling" if OI_IND_ENABLING_PATTERN.search(value) else "other", value, source_label)
    return "unknown", "", ""


def oi_effective_platform_score(record: dict[str, Any]) -> tuple[int | None, str]:
    overrides = (((record.get("meta") or {}).get("human_review") or {}).get("overrides") or {})
    score_overrides = overrides.get("scores") or {}
    override = score_overrides.get("platform_attractiveness") if isinstance(score_overrides, dict) else None
    if isinstance(override, int) and not isinstance(override, bool) and 0 <= override <= 3:
        return override, "Tab3에 이미 입력된 구조화 데이터"
    score = (
        (((record.get("scoring") or {}).get("criteria") or {}).get("platform_attractiveness") or {})
        .get("score")
    )
    if isinstance(score, int) and not isinstance(score, bool) and 0 <= score <= 3:
        return score, "Tab2 상세 리포트"
    return None, ""


def oi_auto_evidence_sources(record: dict[str, Any]) -> list[str]:
    meta = record.get("meta") or {}
    labels: list[str] = []
    if str((record.get("source_report") or {}).get("raw_markdown") or "").strip():
        labels.append(f"Tab2 원문 리포트: {meta.get('output_filename_base') or '원문 리포트'}")
    attachments = meta.get("attachments")
    if isinstance(attachments, list):
        for item in attachments:
            if not isinstance(item, dict) or not item.get("filename"):
                continue
            filename = str(item.get("filename"))
            if extract_attachment_text(item) or "admet" in filename.lower():
                labels.append(f"사용자 업로드 파일: {filename}")
    return labels


def oi_unique_sources(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def classify_oi_partnership(record: dict[str, Any], focus: dict[str, Any]) -> dict[str, Any]:
    text_sources = oi_text_sources(record)
    indication_state, indication, indication_source = oi_indication_state(record, text_sources)
    evidence_sources = [indication_source]
    base = {
        "criteria_version": OI_PARTNERSHIP_CRITERIA_VERSION,
        "indication": indication or "Unknown",
    }
    if indication_state == "unknown":
        return {
            **base,
            "partnership_type": "unknown",
            "note": "Indication 확인 불가",
            "evidence_sources": [],
        }
    if indication_state == "non_target":
        return {
            **base,
            "partnership_type": "n_a",
            "note": "대상 적응증 아님",
            "evidence_sources": oi_unique_sources(evidence_sources),
        }

    modality_state, modality, modality_source = oi_modality_state(record, text_sources)
    evidence_sources.append(modality_source)
    base["modality"] = modality or "Unknown"
    if modality_state == "unknown":
        return {
            **base,
            "partnership_type": "unknown",
            "note": "Modality 확인 불가",
            "evidence_sources": oi_unique_sources(evidence_sources),
        }

    if modality_state == "small_molecule":
        in_vivo = str(focus.get("in_vivo_status") or "N/A").upper()
        in_vitro = str(focus.get("in_vitro_status") or "N/A").upper()
        admet = focus.get("admet_completed")
        missing: list[str] = []
        if in_vivo not in {"O", "X"}:
            missing.append("In Vivo")
        if in_vitro not in {"O", "X"}:
            missing.append("In Vitro")
        if not isinstance(admet, int) or isinstance(admet, bool):
            missing.append("ADMET Score")
        if focus.get("in_vivo_status_source") == "manual" or focus.get("in_vitro_status_source") == "manual" or focus.get("admet_completed_source") == "manual":
            evidence_sources.append("Tab3에 이미 입력된 구조화 데이터")
        evidence_sources.extend(oi_auto_evidence_sources(record))
        if missing:
            return {
                **base,
                "partnership_type": "unknown",
                "note": f"{', '.join(missing)} 확인 불가",
                "evidence_sources": oi_unique_sources(evidence_sources),
            }
        if in_vivo == "O" and in_vitro == "O" and admet >= 25:
            return {
                **base,
                "partnership_type": "value_up",
                "note": f"Small Molecule / In Vivo O / In Vitro O / ADMET {admet}",
                "evidence_sources": oi_unique_sources(evidence_sources),
            }
        failed_conditions: list[str] = []
        if in_vivo != "O":
            failed_conditions.append(f"In Vivo {in_vivo}")
        if in_vitro != "O":
            failed_conditions.append(f"In Vitro {in_vitro}")
        if admet < 25:
            failed_conditions.append(f"ADMET {admet} (<25)")
        return {
            **base,
            "partnership_type": "n_a",
            "note": "OI Partnership 분류 조건 미충족 / " + " / ".join(failed_conditions),
            "evidence_sources": oi_unique_sources(evidence_sources),
        }

    stage_state, stage, stage_source = oi_stage_state(record, text_sources)
    platform_score, platform_source = oi_effective_platform_score(record)
    evidence_sources.extend([stage_source, platform_source])
    base["development_stage"] = stage or "Unknown"
    base["platform_attractiveness_score"] = platform_score
    missing = []
    if stage_state == "unknown":
        missing.append("Development Stage")
    if platform_score is None:
        missing.append("Platform Attractiveness Score")
    if missing:
        return {
            **base,
            "partnership_type": "unknown",
            "note": f"{' 및 '.join(missing)} 확인 불가",
            "evidence_sources": oi_unique_sources(evidence_sources),
        }
    is_investment = stage_state == "ind_enabling"
    is_joint_research = platform_score == 3
    if is_investment and is_joint_research:
        return {
            **base,
            "partnership_type": "joint_research",
            "note": "투자 또한 해당 / Non-Small Molecule / IND Enabling / Platform Attractiveness Score 3",
            "evidence_sources": oi_unique_sources(evidence_sources),
        }
    if is_joint_research:
        return {
            **base,
            "partnership_type": "joint_research",
            "note": "Non-Small Molecule / Platform Attractiveness Score 3",
            "evidence_sources": oi_unique_sources(evidence_sources),
        }
    if is_investment:
        return {
            **base,
            "partnership_type": "investment",
            "note": "Non-Small Molecule / IND Enabling",
            "evidence_sources": oi_unique_sources(evidence_sources),
        }
    return {
        **base,
        "partnership_type": "n_a",
        "note": (
            "OI Partnership 분류 조건 미충족 / "
            f"Development Stage {stage} / Platform Attractiveness Score {platform_score}"
        ),
        "evidence_sources": oi_unique_sources(evidence_sources),
    }


def apply_auto_oi_partnership(
    focus: dict[str, Any],
    record: dict[str, Any],
    *,
    force: bool = False,
) -> dict[str, Any]:
    result = classify_oi_partnership(record, focus)
    classified_at = datetime.now(timezone.utc).isoformat()
    focus["partnership_auto_suggestion"] = result["partnership_type"]
    focus["partnership_auto_note"] = result["note"]
    focus["partnership_auto_evidence_sources"] = result["evidence_sources"]
    focus["partnership_classification_criteria_version"] = result["criteria_version"]
    if focus.get("partnership_classification_source") == "manual" and not force:
        focus["partnership_evidence_sources"] = result["evidence_sources"]
        return result
    focus["partnership_type"] = result["partnership_type"]
    focus["partnership_note"] = result["note"]
    focus["partnership_evidence_sources"] = result["evidence_sources"]
    focus["partnership_classification_source"] = "auto"
    focus["partnership_classification_status"] = "auto_classified"
    focus["partnership_classified_at"] = classified_at
    return result


def refresh_tracked_oi_classifications(records: list[dict[str, Any]]) -> bool:
    changed = False
    for record in records:
        if is_fast_triage_record(record):
            continue
        focus = (record.get("meta") or {}).get("focus_management")
        if not isinstance(focus, dict) or focus.get("is_tracked") is not True:
            continue
        needs_refresh = (
            focus.get("partnership_classification_criteria_version") != OI_PARTNERSHIP_CRITERIA_VERSION
            or focus.get("partnership_classification_status") in {None, "", "pending_criteria"}
            or not focus.get("partnership_type")
        )
        if not needs_refresh:
            continue
        before = copy.deepcopy(focus)
        apply_auto_detected_evidence(focus, record)
        apply_auto_oi_partnership(focus, record)
        if focus != before:
            changed = True
    return changed


def preserve_dashboard_meta(incoming: dict[str, Any], existing: dict[str, Any]) -> None:
    incoming_meta = incoming.setdefault("meta", {})
    existing_meta = existing.get("meta") or {}
    for key in ("focus_management", "attachments", "collaboration", "qualitative_review", "human_review"):
        if key in existing_meta:
            incoming_meta[key] = copy.deepcopy(existing_meta[key])


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


WIKI_LINK_RE = re.compile(r"!?\[\[([^\]]+)\]\]")


def extract_wiki_links(text: str) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for match in WIKI_LINK_RE.findall(text or ""):
        target = match.split("|", 1)[0].split("#", 1)[0].strip()
        if target and target not in seen:
            links.append(target)
            seen.add(target)
    return links


def wiki_path_is_safe(path: Path) -> bool:
    try:
        path.resolve().relative_to(WIKI_DIR.resolve())
    except ValueError:
        return False
    return True


def resolve_wiki_link(link: str) -> Path | None:
    clean = link.strip().replace("\\", "/")
    if not clean:
        return None

    relative = clean if clean.endswith(".md") else f"{clean}.md"
    direct = WIKI_DIR / relative
    if direct.exists() and direct.suffix.lower() == ".md" and wiki_path_is_safe(direct):
        return direct

    target_name = Path(relative).name.lower()
    for path in WIKI_DIR.rglob("*.md"):
        if path.name.lower() == target_name and wiki_path_is_safe(path):
            return path
    return None


def wiki_link_priority(link: str, query_terms: set[str]) -> int:
    lowered = link.lower()
    priority = 0
    folder_weights = {
        "10_scorecards": 14,
        "01_raw_reports": 12,
        "09_evidence_sources": 12,
        "08_competitors": 10,
        "04_targets": 8,
        "05_moa": 8,
        "07_indications": 6,
        "03_companies": 5,
        "11_themes_clusters": 5,
        "06_modalities_platforms": 4,
    }
    for folder, weight in folder_weights.items():
        if folder in lowered:
            priority += weight
            break
    for term in query_terms:
        if len(term) >= 3 and term in lowered:
            priority += 3
    return priority


def merge_wiki_result(
    results: dict[str, dict[str, str | int]],
    item: dict[str, str | int],
    *,
    score_boost: int = 0,
    stage: str = "",
) -> None:
    path = str(item.get("path") or "")
    if not path:
        return

    next_item = dict(item)
    next_score = int(next_item.get("score") or 0) + score_boost
    next_item["score"] = next_score
    if stage:
        next_item["retrieval_stage"] = stage

    existing = results.get(path)
    if not existing:
        results[path] = next_item
        return

    existing["score"] = int(existing.get("score") or 0) + next_score
    matched_terms = [
        term.strip()
        for source in (existing.get("matched_terms"), next_item.get("matched_terms"))
        for term in str(source or "").split(",")
        if term.strip()
    ]
    existing["matched_terms"] = ", ".join(list(dict.fromkeys(matched_terms))[:12])

    stages = [
        value.strip()
        for source in (existing.get("retrieval_stage"), next_item.get("retrieval_stage"))
        for value in str(source or "").split(" + ")
        if value.strip()
    ]
    if stages:
        existing["retrieval_stage"] = " + ".join(list(dict.fromkeys(stages))[:4])


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


def build_agentic_wiki_queries(record: dict[str, Any], message: str, dashboard_context: str = "") -> list[str]:
    summary = record.get("json_summary") or {}
    asset = str(summary.get("asset_name") or "")
    company = str(summary.get("company") or "")
    target = str(summary.get("target") or "")
    theme = str(summary.get("theme") or "")
    cluster = str(summary.get("cluster") or "")
    indication = str(get_nested(record, "structured_table.indication", ""))
    stage = str(get_nested(record, "structured_table.development_stage", ""))

    candidates = [
        build_wiki_search_query(record, message, dashboard_context),
        " ".join(item for item in [asset, company, target, "scorecard evidence source"] if item),
        " ".join(item for item in [target, indication, theme, cluster, "biology moa rationale"] if item),
        " ".join(item for item in [asset, target, indication, "competitor similar landscape benchmark"] if item),
        " ".join(item for item in [asset, indication, "marketability TAP peak sales prevalence pricing"] if item),
        " ".join(item for item in [asset, stage, "data maturity clinical trial efficacy safety"] if item),
    ]

    queries: list[str] = []
    seen: set[str] = set()
    for query in candidates:
        normalized = re.sub(r"\s+", " ", query).strip()
        if normalized and normalized.lower() not in seen:
            queries.append(normalized)
            seen.add(normalized.lower())
    return queries


def agentic_search_wiki_notes(
    record: dict[str, Any],
    message: str,
    dashboard_context: str = "",
    top_k: int = CHAT_WIKI_TOP_K,
) -> list[dict[str, str | int]]:
    base_query = build_wiki_search_query(record, message, dashboard_context)
    query_terms = tokenize_for_search(base_query)
    if not query_terms:
        return []

    merged: dict[str, dict[str, str | int]] = {}
    queries = build_agentic_wiki_queries(record, message, dashboard_context)

    for index, query in enumerate(queries):
        boost = max(0, 18 - index * 3)
        stage = "planned_query" if index == 0 else f"planned_query_{index + 1}"
        for item in search_wiki_notes(query, top_k=CHAT_WIKI_AGENT_SEARCH_TOP_K):
            merge_wiki_result(merged, item, score_boost=boost, stage=stage)

    seed_items = sorted(merged.values(), key=lambda item: int(item.get("score") or 0), reverse=True)[:top_k]
    linked_candidates: list[tuple[int, Path, str]] = []
    seen_links: set[str] = set()

    for item in seed_items:
        path = WIKI_DIR / str(item.get("path") or "")
        if not path.exists() or not wiki_path_is_safe(path):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        for link in extract_wiki_links(text):
            linked_path = resolve_wiki_link(link)
            if not linked_path:
                continue
            relative = linked_path.relative_to(WIKI_DIR).as_posix()
            if relative in seen_links or relative == item.get("path"):
                continue
            seen_links.add(relative)
            priority = wiki_link_priority(relative, query_terms)
            linked_candidates.append((priority + int(item.get("score") or 0) // 8, linked_path, link))

    linked_candidates.sort(key=lambda candidate: candidate[0], reverse=True)
    for priority, path, link in linked_candidates[:CHAT_WIKI_LINK_EXPANSION_LIMIT]:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        relative_path = path.relative_to(WIKI_DIR).as_posix()
        link_terms = tokenize_for_search(link)
        snippet_terms = query_terms | link_terms
        matched_terms = ", ".join(list(dict.fromkeys(sorted(link_terms | (query_terms & tokenize_for_search(text)))))[:10])
        item = {
            "path": relative_path,
            "score": max(1, priority),
            "matched_terms": matched_terms or link,
            "snippet": make_wiki_snippet(text, snippet_terms),
        }
        merge_wiki_result(merged, item, score_boost=6, stage="linked_note")

    ranked = sorted(merged.values(), key=lambda item: int(item.get("score") or 0), reverse=True)
    return ranked[:top_k]


def format_wiki_context(snippets: list[dict[str, str | int]]) -> str:
    if not snippets:
        return "No relevant wiki notes found."
    blocks = []
    for index, item in enumerate(snippets, 1):
        stage = f", via: {item['retrieval_stage']}" if item.get("retrieval_stage") else ""
        blocks.append(
            f"[Wiki {index}] {item['path']} (score {item['score']}, matched: {item['matched_terms']}{stage})\n"
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
    wiki_snippets = agentic_search_wiki_notes(record, message, dashboard_context)
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

        try:
            response = post_openrouter(payload, api_key)
            data = response.json()
        except requests.HTTPError as exc:
            response = exc.response
            status_code = response.status_code if response is not None else 0
            detail = response.text if response is not None else str(exc)
            errors.append(f"{model}: HTTP {status_code} - {summarize_openrouter_error(detail)}")
            if status_code in {401, 402, 403} or "free-models-per-day" in detail.lower():
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
    wiki_snippets = agentic_search_wiki_notes(record, message, dashboard_context)
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
        try:
            response = post_openrouter(payload, api_key, stream=True)
            return RequestsLineStream(response), wiki_snippets, None
        except requests.HTTPError as exc:
            response = exc.response
            status_code = response.status_code if response is not None else 0
            detail = response.text if response is not None else str(exc)
            errors.append(f"{model}: HTTP {status_code} - {summarize_openrouter_error(detail)}")
            if status_code in {401, 402, 403} or "free-models-per-day" in detail.lower():
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


@app.get("/triage-detail")
def triage_detail() -> FileResponse:
    return FileResponse(ROOT / "triage_detail.html")


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
    if refresh_tracked_oi_classifications(records):
        save_records(records)
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
        focus = (updated_record.get("meta") or {}).get("focus_management")
        if isinstance(focus, dict) and focus.get("is_tracked") is True:
            apply_auto_oi_partnership(focus, updated_record)
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
    refreshed = refresh_tracked_oi_classifications(records)
    if refreshed:
        save_records(records)
    for record in records:
        if record_key(record) == record_id:
            return {"record": record, "record_id": record_id}
    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


MANUAL_REVIEW_SCORE_FIELDS = {
    "target_relevance",
    "competitive_landscape",
    "moa_validity",
    "platform_attractiveness",
    "expansion_potential",
    "data_maturity",
    "marketability",
}
TRIAGE_MANUAL_REVIEW_SCORE_FIELDS = {
    "target_relevance",
    "moa_validity",
    "data_maturity",
}


def full_scout_rubric_score_map(record: dict[str, Any]) -> dict[str, int | float | None]:
    criteria = ((record.get("scoring") or {}).get("criteria") or {})
    result: dict[str, int | float | None] = {}
    for criterion_id in MANUAL_REVIEW_SCORE_FIELDS:
        criterion = criteria.get(criterion_id) if isinstance(criteria, dict) else {}
        value = criterion.get("score") if isinstance(criterion, dict) else None
        result[criterion_id] = (
            value
            if not isinstance(value, bool) and isinstance(value, (int, float))
            else None
        )
    return result


def full_scout_rubric_filter_text(record: dict[str, Any]) -> str:
    values: list[str] = []
    criteria = ((record.get("scoring") or {}).get("criteria") or {})
    if isinstance(criteria, dict):
        for criterion in criteria.values():
            if not isinstance(criterion, dict):
                continue
            for key in (
                "main_line_summary",
                "investigation_note",
                "why_not_higher",
                "uncertain_points",
            ):
                value = criterion.get(key)
                if isinstance(value, list):
                    values.extend(str(item) for item in value if item)
                elif value:
                    values.append(str(value))
    validation = record.get("validation") if isinstance(record.get("validation"), dict) else {}
    uncertain_points = validation.get("uncertain_points")
    if isinstance(uncertain_points, list):
        values.extend(str(item) for item in uncertain_points if item)
    final_insight = record.get("final_insight") if isinstance(record.get("final_insight"), dict) else {}
    for key in ("one_line_summary", "most_important_diligence_question"):
        if final_insight.get(key):
            values.append(str(final_insight[key]))
    return " | ".join(values)


def calculate_latest_full_scout_filter(record: dict[str, Any]) -> dict[str, Any]:
    score_map = full_scout_rubric_score_map(record)
    numeric_scores = [value for value in score_map.values() if isinstance(value, (int, float))]
    total = sum(numeric_scores) if len(numeric_scores) == len(MANUAL_REVIEW_SCORE_FIELDS) else None
    target_score = score_map.get("target_relevance")
    moa_score = score_map.get("moa_validity")
    data_score = score_map.get("data_maturity")
    summary = record.get("json_summary") if isinstance(record.get("json_summary"), dict) else {}
    theme_cluster = f"{summary.get('theme') or ''} {summary.get('cluster') or ''}".strip().lower()
    no_theme_fit = (
        not theme_cluster
        or re.search(r"n/?a|no theme|no cluster|no mapped|none|미해당", theme_cluster) is not None
    )
    notes = full_scout_rubric_filter_text(record)
    fail_blocker = re.search(
        r"outside primary|outside.*theme|out of scope|no public target|no.*target/moa|"
        r"discontinued|dormant|범위 밖|미해당|중단",
        notes,
        flags=re.IGNORECASE,
    ) is not None
    review_uncertainty = re.search(
        r"stage|rights?|license|licensed|ownership|asset identity|identity|source|official|"
        r"registry|unclear|uncertain|not public|not verified|confirmation|confirm|sponsor|"
        r"단계|권리|출처|공식|불확실|확인|미확인|식별|정체|라이선스|스폰서",
        notes,
        flags=re.IGNORECASE,
    ) is not None
    reasons: list[str] = []

    if total is not None and total <= 8:
        reasons.append(f"Total score {total} <= 8")
    if target_score is not None and target_score <= 1:
        reasons.append(f"Target Relevance {target_score} <= 1")
    if no_theme_fit:
        reasons.append("SKBP Theme/Cluster fit 없음")
    if fail_blocker:
        reasons.append("Hard blocker 확인")
    if reasons:
        return {"status": "FAIL", "reason": "; ".join(reasons), "total_score": total}

    pass_scores = (
        total is not None
        and total >= 14
        and target_score is not None
        and target_score >= 3
        and moa_score is not None
        and moa_score >= 2
        and data_score is not None
        and data_score >= 2
    )
    if pass_scores and not review_uncertainty:
        return {
            "status": "PASS",
            "reason": (
                f"Rubric v{SCORING_CRITERIA_VERSION}: Total {total} >= 14, "
                f"TR {target_score} >= 3, MOA {moa_score} >= 2, "
                f"Data {data_score} >= 2, hard blocker 없음"
            ),
            "total_score": total,
        }

    if total is not None and 9 <= total <= 13:
        reasons.append(f"Total score {total} is REVIEW range 9-13")
    if not pass_scores:
        reasons.append(
            f"PASS gate 미충족: Total {total if total is not None else '-'}, "
            f"TR {target_score if target_score is not None else '-'}, "
            f"MOA {moa_score if moa_score is not None else '-'}, "
            f"Data {data_score if data_score is not None else '-'}"
        )
    if review_uncertainty:
        reasons.append("stage/rights/asset identity/source 불확실성 확인 필요")
    return {
        "status": "REVIEW",
        "reason": "; ".join(reasons) or "추가 diligence 필요",
        "total_score": total,
    }


def annotate_rubric_recalculation(
    raw_markdown: str,
    version: str,
    applied_date: str,
) -> str:
    banner = (
        f"> **Recalculated by Full Scout Rubric v{version}:** "
        f"{applied_date} 대시보드에서 저장된 7개 criterion score와 최신 v{version} "
        "Filter 2 규칙으로 Total Score 및 결정값을 재계산했습니다. "
        "원조사 evidence와 본문, 담당자의 수기 보정값은 변경하지 않았습니다."
    )
    text = str(raw_markdown or "")
    pattern = r"> \*\*Recalculated by Full Scout Rubric v[^:]+:\*\* [^\n]+"
    if re.search(pattern, text):
        return re.sub(pattern, banner, text, count=1)
    lines = text.splitlines()
    if lines and lines[0].startswith("#"):
        lines[1:1] = ["", banner]
        return "\n".join(lines)
    return f"{banner}\n\n{text}".rstrip()


@app.post("/api/records/{record_id:path}/recalculate-rubric")
def recalculate_record_with_latest_rubric(record_id: str) -> dict[str, Any]:
    records = load_records()
    for index, record in enumerate(records):
        if record_key(record) != record_id:
            continue
        if is_fast_triage_record(record):
            raise HTTPException(
                status_code=400,
                detail="Latest Full Scout rubric recalculation is available only in TAB2.",
            )

        recalculated_at = datetime.now(timezone.utc).isoformat()
        previous_version = str((record.get("meta") or {}).get("rubric_version") or "")
        result = calculate_latest_full_scout_filter(record)
        scoring = record.setdefault("scoring", {})
        if result["total_score"] is not None:
            scoring["total_score"] = result["total_score"]
        scoring["max_score"] = 21
        hard_filter = record.setdefault("hard_filter", {})
        hard_filter["status"] = result["status"]
        hard_filter["reason"] = result["reason"]

        meta = record.setdefault("meta", {})
        meta["rubric_version"] = SCORING_CRITERIA_VERSION
        meta["rubric_recalculation"] = {
            "version": SCORING_CRITERIA_VERSION,
            "previous_version": previous_version or None,
            "recalculated_at": recalculated_at,
            "source": "dashboard_tab2_rubric_refresh",
            "scope": "stored_criterion_scores_total_and_filter2",
        }
        source_report = record.setdefault("source_report", {})
        source_report["raw_markdown"] = annotate_rubric_recalculation(
            str(source_report.get("raw_markdown") or ""),
            SCORING_CRITERIA_VERSION,
            recalculated_at[:10],
        )
        source_report["rubric_recalculation"] = copy.deepcopy(meta["rubric_recalculation"])

        records[index] = record
        save_records(records)
        exports = run_markdown_exports()
        return {
            "ok": True,
            "record_id": record_id,
            "record": record,
            "rubric_version": SCORING_CRITERIA_VERSION,
            "previous_version": previous_version or None,
            "recalculated_at": recalculated_at,
            "exports": exports,
        }

    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


@app.patch("/api/records/{record_id:path}/manual-review")
async def update_manual_review(record_id: str, request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from None

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Expected a manual review edit object.")

    edit_kind = str(payload.get("kind") or "").strip().lower()
    actor_name = str(payload.get("actor_name") or "").strip()
    if len(actor_name) > 100:
        raise HTTPException(status_code=400, detail="actor_name must be 100 characters or fewer.")
    records = load_records()
    actor_ip = get_client_ip(request)
    for index, record in enumerate(records):
        if record_key(record) != record_id:
            continue

        is_triage = is_fast_triage_record(record)
        meta = record.setdefault("meta", {})
        human_review = meta.setdefault("human_review", {})
        overrides = human_review.setdefault("overrides", {})
        baseline = human_review.setdefault("ai_baseline", {})
        changed_at = datetime.now(timezone.utc).isoformat()

        if edit_kind == "status":
            value = str(payload.get("value") or "").strip().upper()
            allowed = {"SELECT", "REJECT", "N/A"} if is_triage else {"PASS", "REVIEW", "FAIL"}
            if value not in allowed:
                raise HTTPException(
                    status_code=400,
                    detail=f"Status must be one of: {', '.join(sorted(allowed))}.",
                )
            field_key = "filter_status"
            previous = overrides.get(field_key)
            if previous is None:
                previous = payload.get("previous_value") or (record.get("hard_filter") or {}).get("status")
                baseline.setdefault(field_key, previous)
            overrides[field_key] = value
        elif edit_kind == "status_reason":
            value = str(payload.get("value") or "").strip()
            if len(value) > 500:
                raise HTTPException(status_code=400, detail="Status reason must be 500 characters or fewer.")
            field_key = "status_reason"
            previous = overrides.get(field_key)
            if previous is None:
                previous = str(payload.get("previous_value") or "")
                baseline.setdefault(field_key, previous)
            overrides[field_key] = value
        elif edit_kind == "score":
            if is_triage:
                raise HTTPException(
                    status_code=400,
                    detail="Individual score overrides are available only in TAB2 Full Scout.",
                )
            criterion_id = str(payload.get("criterion") or "").strip()
            allowed_criteria = MANUAL_REVIEW_SCORE_FIELDS
            if criterion_id not in allowed_criteria:
                raise HTTPException(status_code=400, detail=f"Score field is not editable: {criterion_id}")
            value = payload.get("value")
            if isinstance(value, bool) or not isinstance(value, int) or value not in {0, 1, 2, 3}:
                raise HTTPException(status_code=400, detail="Score must be an integer from 0 to 3.")

            score_overrides = overrides.setdefault("scores", {})
            baseline_scores = baseline.setdefault("scores", {})
            criterion = (((record.get("scoring") or {}).get("criteria") or {}).get(criterion_id) or {})
            previous = score_overrides.get(criterion_id)
            if previous is None:
                previous = payload.get("previous_value")
                if previous is None:
                    previous = criterion.get("score")
                baseline_scores.setdefault(criterion_id, previous)
            score_overrides[criterion_id] = value
            field_key = f"scores.{criterion_id}"
        elif edit_kind == "total_score":
            if is_triage:
                raise HTTPException(
                    status_code=400,
                    detail="Total Score overrides are available only in TAB2 Full Scout.",
                )
            value = payload.get("value")
            if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 21:
                raise HTTPException(status_code=400, detail="Total Score must be an integer from 0 to 21.")
            field_key = "total_score"
            previous = overrides.get(field_key)
            if previous is None:
                previous = payload.get("previous_value")
                if previous is None:
                    previous = (record.get("scoring") or {}).get("total_score")
                baseline.setdefault(field_key, previous)
            overrides[field_key] = value
        else:
            raise HTTPException(
                status_code=400,
                detail="kind must be status, status_reason, score, or total_score.",
            )

        history = human_review.setdefault("history", [])
        history.append(
            {
                "changed_at": changed_at,
                "actor_ip": actor_ip,
                "actor_name": actor_name,
                "source": "dashboard_table",
                "field": field_key,
                "previous_value": previous,
                "new_value": value,
            }
        )
        human_review["last_updated_at"] = changed_at
        human_review["last_updated_source"] = "dashboard_table"
        human_review["last_updated_by"] = actor_name or actor_ip
        human_review["has_manual_override"] = True
        if len(history) > 100:
            human_review["history"] = history[-100:]

        append_edit_history(
            record,
            source="dashboard_table_manual_review",
            actor_ip=actor_ip,
            actor_name=actor_name,
            field=field_key,
            previous_value=previous,
            new_value=value,
        )
        focus = meta.get("focus_management")
        if (
            edit_kind == "score"
            and criterion_id == "platform_attractiveness"
            and isinstance(focus, dict)
            and focus.get("is_tracked") is True
        ):
            apply_auto_oi_partnership(focus, record)

        records[index] = record
        save_records(records)
        exports = run_markdown_exports()
        return {
            "ok": True,
            "record_id": record_id,
            "record": record,
            "human_review": human_review,
            "exports": exports,
        }

    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


@app.patch("/api/records/{record_id:path}/focus-management")
async def update_focus_management(record_id: str, request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from None

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Expected a focus management update object.")

    action = str(payload.get("action") or "").strip().lower()
    if action not in {"add", "remove", "update"}:
        raise HTTPException(status_code=400, detail="action must be add, remove, or update.")

    actor_name = str(payload.get("actor_name") or "").strip()
    if len(actor_name) > 100:
        raise HTTPException(status_code=400, detail="actor_name must be 100 characters or fewer.")
    records = load_records()
    actor_ip = get_client_ip(request)
    for index, record in enumerate(records):
        if record_key(record) != record_id:
            continue
        if is_fast_triage_record(record):
            raise HTTPException(status_code=400, detail="Only Full Scout records can be added to TAB3.")

        changed_at = datetime.now(timezone.utc).isoformat()
        meta = record.setdefault("meta", {})
        focus = meta.setdefault("focus_management", {})
        history_field = f"focus_management.{action}"
        previous_value: Any = None
        new_value: Any = None

        if action == "add":
            previous_value = focus.get("is_tracked", False)
            focus["is_tracked"] = True
            focus.setdefault("added_at", changed_at)
            focus.setdefault("user_comment", "")
            focus.setdefault("due_date", "")
            focus.setdefault("owner_name", "")
            focus.setdefault("action_plan", "")
            focus.setdefault("partnership_type", "")
            focus.setdefault("partnership_classification_status", "pending_criteria")
            material_flags = focus.setdefault("partner_material_flags", {})
            for material_key in ("cdp", "ncdp", "admet"):
                material_flags.setdefault(material_key, False)
            focus.pop("removed_at", None)
            apply_auto_detected_evidence(focus, record, force=True)
            apply_auto_oi_partnership(focus, record)
            new_value = True
        elif action == "remove":
            previous_value = focus.get("is_tracked", False)
            focus["is_tracked"] = False
            focus["removed_at"] = changed_at
            new_value = False
        else:
            field = str(payload.get("field") or "").strip()
            history_field = f"focus_management.{field}"
            previous_value = focus.get(field)
            if field in {"user_comment", "action_plan"}:
                value = str(payload.get("value") or "")
                max_length = 5000 if field == "user_comment" else 500
                if len(value) > max_length:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{field} must be {max_length} characters or fewer.",
                    )
                focus[field] = value
            elif field == "owner_name":
                value = str(payload.get("value") or "").strip()
                if len(value) > 100:
                    raise HTTPException(status_code=400, detail="Owner name must be 100 characters or fewer.")
                focus[field] = value
            elif field == "due_date":
                value = str(payload.get("value") or "").strip()
                if value and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                    raise HTTPException(status_code=400, detail="Due date must use YYYY-MM-DD.")
                focus["due_date"] = value
            elif field == "partnership_type":
                value = str(payload.get("value") or "").strip()
                allowed_partnership_types = {"", *OI_PARTNERSHIP_TYPES}
                if value not in allowed_partnership_types:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "partnership_type must be value_up, joint_research, investment, "
                            "n_a, unknown, or empty for automatic reclassification."
                        ),
                    )
                auto_result = classify_oi_partnership(record, focus)
                focus["partnership_auto_suggestion"] = auto_result["partnership_type"]
                focus["partnership_auto_note"] = auto_result["note"]
                focus["partnership_auto_evidence_sources"] = auto_result["evidence_sources"]
                focus["partnership_classification_criteria_version"] = OI_PARTNERSHIP_CRITERIA_VERSION
                if value:
                    focus["partnership_type"] = value
                    focus["partnership_note"] = (
                        "담당자 수동 분류 / 자동 제안 "
                        f"{OI_PARTNERSHIP_LABELS[auto_result['partnership_type']]}: {auto_result['note']}"
                    )
                    focus["partnership_evidence_sources"] = auto_result["evidence_sources"]
                    focus["partnership_classification_source"] = "manual"
                    focus["partnership_classification_status"] = "manual_override"
                    focus["partnership_classified_at"] = changed_at
                else:
                    focus["partnership_classification_source"] = "auto"
                    apply_auto_oi_partnership(focus, record, force=True)
                    value = focus["partnership_type"]
            elif field == "partnership_note":
                value = str(payload.get("value") or "").strip()
                if len(value) > 500:
                    raise HTTPException(status_code=400, detail="partnership_note must be 500 characters or fewer.")
                focus["partnership_note"] = value
                focus["partnership_classification_source"] = "manual"
                focus["partnership_classification_status"] = "manual_override"
                focus["partnership_classified_at"] = changed_at
            elif field == "partner_material_flag":
                material_key = str(payload.get("value") or "").strip().lower()
                allowed_material_keys = {"cdp", "ncdp", "admet"}
                if material_key not in allowed_material_keys:
                    raise HTTPException(
                        status_code=400,
                        detail="partner material key must be cdp, ncdp, or admet.",
                    )
                active = payload.get("active")
                if not isinstance(active, bool):
                    raise HTTPException(
                        status_code=400,
                        detail="partner material active state must be true or false.",
                    )
                material_flags = focus.setdefault("partner_material_flags", {})
                material_overrides = focus.setdefault("partner_material_flag_overrides", {})
                history_field = f"focus_management.partner_material_flags.{material_key}"
                previous_value = material_flags.get(material_key, False)
                material_flags[material_key] = active
                material_overrides[material_key] = active
                value = active
            elif field in {"in_vivo_status", "in_vitro_status"}:
                value = str(payload.get("value") or "").strip().upper()
                if value not in {"O", "X", "N/A"}:
                    raise HTTPException(status_code=400, detail=f"{field} must be O, X, or N/A.")
                focus[field] = value
                focus[f"{field}_source"] = "manual"
                apply_auto_oi_partnership(focus, record)
            elif field == "admet_completed":
                raw_value = payload.get("value")
                if raw_value in (None, ""):
                    value = None
                else:
                    try:
                        value = int(raw_value)
                    except (TypeError, ValueError):
                        raise HTTPException(
                            status_code=400,
                            detail="admet_completed must be an integer between 0 and 50, or empty.",
                        ) from None
                    if not 0 <= value <= ADMET_TOTAL_ITEMS:
                        raise HTTPException(
                            status_code=400,
                            detail=f"admet_completed must be an integer between 0 and {ADMET_TOTAL_ITEMS}, or empty.",
                        )
                focus["admet_completed"] = value
                focus["admet_completed_source"] = "manual"
                apply_auto_oi_partnership(focus, record)
            else:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "field must be user_comment, due_date, owner_name, action_plan, partnership_type, partnership_note, "
                        "partner_material_flag, in_vivo_status, in_vitro_status, or admet_completed."
                    ),
                )
            new_value = value
            focus["is_tracked"] = True
            focus.setdefault("added_at", changed_at)

        focus["updated_at"] = changed_at
        focus["updated_source"] = "dashboard_tab3"
        focus["updated_by"] = actor_name or actor_ip
        append_edit_history(
            record,
            source="dashboard_tab3_focus_management",
            actor_ip=actor_ip,
            actor_name=actor_name,
            field=history_field,
            previous_value=previous_value,
            new_value=new_value,
        )
        records[index] = record
        save_records(records)
        return {
            "ok": True,
            "record_id": record_id,
            "record": record,
            "focus_management": focus,
        }

    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


@app.post("/api/records/{record_id:path}/comments")
async def create_record_comment(record_id: str, request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from None

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Expected a comment object.")

    body = str(payload.get("body") or "").strip()
    author = str(payload.get("author") or "").strip() or "익명"
    parent_id = str(payload.get("parent_id") or "").strip() or None
    if not body:
        raise HTTPException(status_code=400, detail="Comment body is required.")
    if len(body) > 5000:
        raise HTTPException(status_code=400, detail="Comment must be 5000 characters or fewer.")
    if len(author) > 100:
        raise HTTPException(status_code=400, detail="Author name must be 100 characters or fewer.")

    records = load_records()
    for index, record in enumerate(records):
        if record_key(record) != record_id:
            continue

        meta = record.setdefault("meta", {})
        collaboration = meta.setdefault("collaboration", {})
        comments = collaboration.setdefault("comments", [])
        if not isinstance(comments, list):
            comments = []
            collaboration["comments"] = comments
        if parent_id and not any(
            isinstance(comment, dict) and str(comment.get("id") or "") == parent_id
            for comment in comments
        ):
            raise HTTPException(status_code=400, detail="Reply parent comment was not found.")

        created_at = datetime.now(timezone.utc).isoformat()
        actor_ip = get_client_ip(request)
        comment = {
            "id": uuid.uuid4().hex,
            "parent_id": parent_id,
            "author": author,
            "actor_ip": actor_ip,
            "body": body,
            "created_at": created_at,
            "updated_at": created_at,
        }
        comments.append(comment)
        collaboration["updated_at"] = created_at
        collaboration["comment_count"] = len(comments)
        append_edit_history(
            record,
            source="dashboard_comment",
            actor_ip=actor_ip,
            field="collaboration.comments",
        )
        records[index] = record
        save_records(records)
        return {
            "ok": True,
            "record_id": record_id,
            "record": record,
            "comment": comment,
            "comments": comments,
        }

    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


@app.post("/api/records/{record_id:path}/attachments")
async def upload_record_attachment(
    record_id: str,
    request: Request,
    file: UploadFile = File(...),
    uploaded_by: str = Form(""),
) -> dict[str, Any]:
    original_name = file.filename or "attachment"
    extension = Path(original_name).suffix.lower()
    if extension not in ATTACHMENT_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {extension or '(none)'}. Allowed: {', '.join(sorted(ATTACHMENT_ALLOWED_EXTENSIONS))}.",
        )

    content = await file.read()
    if len(content) > ATTACHMENT_MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"File exceeds the {ATTACHMENT_MAX_BYTES // (1024 * 1024)}MB limit.")

    records = load_records()
    for index, record in enumerate(records):
        if record_key(record) != record_id:
            continue

        record_dir = ATTACHMENTS_DIR / safe_note_name(record_id)
        record_dir.mkdir(parents=True, exist_ok=True)
        stored_filename = f"{uuid.uuid4().hex}_{safe_note_name(Path(original_name).stem)}{extension}"
        stored_file_path = record_dir / stored_filename
        stored_file_path.write_bytes(content)

        created_at = datetime.now(timezone.utc).isoformat()
        actor_ip = get_client_ip(request)
        attachment = {
            "id": uuid.uuid4().hex,
            "filename": original_name,
            "stored_path": f"/attachments/{safe_note_name(record_id)}/{stored_filename}",
            "content_type": file.content_type or "application/octet-stream",
            "size_bytes": len(content),
            "uploaded_by": uploaded_by.strip() or actor_ip,
            "uploaded_at": created_at,
            "processing_status": "processing" if extension in {".pdf", ".ppt", ".pptx"} else "not_applicable",
        }

        meta = record.setdefault("meta", {})
        attachments = meta.setdefault("attachments", [])
        if not isinstance(attachments, list):
            attachments = []
            meta["attachments"] = attachments
        attachments.append(attachment)
        if extension in {".pdf", ".ppt", ".pptx"}:
            try:
                process_attachment_document(records, attachment, stored_file_path)
            except Exception as exc:
                attachment["processing_status"] = "failed"
                attachment["processing_error"] = str(exc)[:1000]
                attachment["document_processing"] = {
                    "document_id": uuid.uuid4().hex,
                    "filename": original_name,
                    "status": "failed",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "error": str(exc)[:1000],
                }
        if not is_fast_triage_record(record):
            focus = meta.setdefault("focus_management", {})
            focus["partnership_classification_status"] = "pending_criteria"
            focus["partnership_evidence_updated_at"] = created_at
            if focus.get("is_tracked"):
                apply_auto_detected_evidence(focus, record)
                apply_auto_oi_partnership(focus, record)

        append_edit_history(
            record,
            source="dashboard_attachment_upload",
            actor_ip=actor_ip,
            field="attachments",
            new_value=original_name,
        )
        records[index] = record
        save_records(records)
        return {
            "ok": True,
            "record_id": record_id,
            "record": record,
            "attachment": attachment,
            "attachments": attachments,
        }

    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


@app.get("/api/attachment-preview/{attachment_id}")
async def preview_record_attachment(attachment_id: str, record_id: str) -> dict[str, Any]:
    records = load_records()
    for record in records:
        if record_key(record) != record_id:
            continue

        attachments = (record.get("meta") or {}).get("attachments")
        if not isinstance(attachments, list):
            raise HTTPException(status_code=404, detail=f"Attachment not found: {attachment_id}")
        attachment = next(
            (
                item
                for item in attachments
                if isinstance(item, dict) and str(item.get("id") or "") == attachment_id
            ),
            None,
        )
        if attachment is None:
            raise HTTPException(status_code=404, detail=f"Attachment not found: {attachment_id}")

        file_path = resolve_attachment_path(attachment)
        suffix = file_path.suffix.lower()
        response: dict[str, Any] = {
            "ok": True,
            "record_id": record_id,
            "attachment": attachment,
            "preview_type": "unsupported",
            "text": "",
            "url": attachment.get("stored_path"),
        }
        preview_pdf_path = str(attachment.get("preview_pdf_path") or "")
        if preview_pdf_path:
            try:
                resolve_attachment_url(preview_pdf_path)
            except HTTPException:
                preview_pdf_path = ""
        if preview_pdf_path:
            response["preview_type"] = "pdf"
            response["url"] = preview_pdf_path
        elif suffix == ".pdf":
            response["preview_type"] = "pdf"
        elif suffix == ".txt":
            response["preview_type"] = "text"
            response["text"] = file_path.read_text(encoding="utf-8", errors="replace")[
                :ATTACHMENT_PREVIEW_TEXT_LIMIT
            ]
        elif suffix in {".pptx", ".docx"}:
            try:
                extracted_text = openxml_text_preview(file_path)
            except (OSError, zipfile.BadZipFile, ElementTree.ParseError):
                extracted_text = ""
            if extracted_text:
                response["preview_type"] = "text"
                response["text"] = extracted_text
        return response

    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


@app.delete("/api/records/{record_id:path}/attachments/{attachment_id}")
async def delete_record_attachment(record_id: str, attachment_id: str, request: Request) -> dict[str, Any]:
    records = load_records()
    for index, record in enumerate(records):
        if record_key(record) != record_id:
            continue

        meta = record.setdefault("meta", {})
        attachments = meta.get("attachments")
        if not isinstance(attachments, list):
            raise HTTPException(status_code=404, detail=f"Attachment not found: {attachment_id}")

        match = next((a for a in attachments if isinstance(a, dict) and a.get("id") == attachment_id), None)
        if match is None:
            raise HTTPException(status_code=404, detail=f"Attachment not found: {attachment_id}")

        try:
            file_path = resolve_attachment_path(match)
        except HTTPException:
            file_path = None
        if file_path is not None and file_path.exists():
            file_path.unlink()
        preview_pdf_path = str(match.get("preview_pdf_path") or "")
        if preview_pdf_path:
            try:
                preview_file_path = resolve_attachment_url(preview_pdf_path)
            except HTTPException:
                preview_file_path = None
            if preview_file_path is not None and preview_file_path.exists():
                preview_file_path.unlink()

        attachments.remove(match)
        focus = meta.get("focus_management")
        if isinstance(focus, dict) and focus.get("is_tracked"):
            apply_auto_detected_evidence(focus, record)
            apply_auto_oi_partnership(focus, record)
        actor_ip = get_client_ip(request)
        append_edit_history(
            record,
            source="dashboard_attachment_delete",
            actor_ip=actor_ip,
            field="attachments",
            previous_value=match.get("filename"),
        )
        records[index] = record
        save_records(records)
        return {
            "ok": True,
            "record_id": record_id,
            "record": record,
            "attachments": attachments,
        }

    raise HTTPException(status_code=404, detail=f"Record not found: {record_id}")


@app.post("/api/records/{record_id:path}/qualitative-review")
async def create_qualitative_review_entry(record_id: str, request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from None

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Expected a qualitative review entry object.")

    criterion_id = str(payload.get("criterion_id") or "").strip()
    if criterion_id not in QUALITATIVE_REVIEW_CRITERIA:
        raise HTTPException(
            status_code=400,
            detail=f"criterion_id must be one of {sorted(QUALITATIVE_REVIEW_CRITERIA)}.",
        )

    body = str(payload.get("body") or "").strip()
    author = str(payload.get("author") or "").strip() or "익명"
    if not body:
        raise HTTPException(status_code=400, detail="Opinion body is required.")
    if len(body) > 5000:
        raise HTTPException(status_code=400, detail="Opinion must be 5000 characters or fewer.")

    records = load_records()
    for index, record in enumerate(records):
        if record_key(record) != record_id:
            continue

        meta = record.setdefault("meta", {})
        qualitative_review = meta.setdefault("qualitative_review", {})
        criteria_state = qualitative_review.setdefault("criteria", {})
        criterion_state = criteria_state.setdefault(criterion_id, {})
        entries = criterion_state.setdefault("entries", [])
        if not isinstance(entries, list):
            entries = []
            criterion_state["entries"] = entries

        created_at = datetime.now(timezone.utc).isoformat()
        actor_ip = get_client_ip(request)
        user_entry = {
            "id": uuid.uuid4().hex,
            "author": author,
            "body": body,
            "is_ai": False,
            "created_at": created_at,
        }
        entries.append(user_entry)
        qualitative_review["updated_at"] = user_entry["created_at"]

        append_edit_history(
            record,
            source="dashboard_qualitative_review",
            actor_ip=actor_ip,
            field=f"qualitative_review.{criterion_id}",
            new_value=body,
        )
        records[index] = record
        save_records(records)
        return {
            "ok": True,
            "record_id": record_id,
            "record": record,
            "entry": user_entry,
        }

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
    actor_ip = get_client_ip(request)
    for index, record in enumerate(records):
        if record_key(record) == record_id:
            preserve_dashboard_meta(payload, record)
            focus = (payload.get("meta") or {}).get("focus_management")
            if isinstance(focus, dict) and focus.get("is_tracked") is True:
                apply_auto_detected_evidence(focus, payload)
                apply_auto_oi_partnership(focus, payload)
            append_edit_history(
                payload,
                source="detail_json_editor",
                actor_ip=actor_ip,
                field="record",
                old_meta=record.get("meta"),
            )
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
    actor_ip = get_client_ip(request)
    inserted = 0
    updated = 0

    for record in incoming:
        key = record_key(record)
        if key in index_by_key:
            existing_record = records[index_by_key[key]]
            preserve_dashboard_meta(record, existing_record)
            focus = (record.get("meta") or {}).get("focus_management")
            if isinstance(focus, dict) and focus.get("is_tracked") is True:
                apply_auto_detected_evidence(focus, record)
                apply_auto_oi_partnership(focus, record)
            append_edit_history(
                record,
                source="paste_json_upsert",
                actor_ip=actor_ip,
                field="record",
                old_meta=existing_record.get("meta"),
            )
            records[index_by_key[key]] = record
            updated += 1
        else:
            focus = (record.get("meta") or {}).get("focus_management")
            if isinstance(focus, dict) and focus.get("is_tracked") is True:
                apply_auto_detected_evidence(focus, record)
                apply_auto_oi_partnership(focus, record)
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
