from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "json" / "pipeline-records.json"
VAULT_DIR = ROOT / "skbp_pipeline_wiki"
SCORING_FULL = ROOT / "config" / "scoring_criteria" / "v3_1_full.md"
SCORING_DISPLAY = ROOT / "config" / "scoring_criteria" / "v3_1_display.md"

CRITERIA = {
    "target_relevance": "Target Relevance",
    "competitive_landscape": "Competitive Landscape",
    "moa_validity": "MoA Validity",
    "platform_attractiveness": "Platform Attractiveness",
    "expansion_potential": "Expansion Potential",
    "data_maturity": "Data Maturity",
    "marketability": "Marketability",
}

FOLDERS = {
    "00_System": "System rules, criteria, taxonomy, and generation documentation.",
    "01_Raw_Reports": "Immutable raw GPT/company Markdown reports used as audit trail.",
    "02_Assets": "Asset hub notes. Each asset links to company, biology, evidence, competitors, and scorecard.",
    "03_Companies": "Company hub notes and backlinks to pipeline assets.",
    "04_Targets": "Target biology notes and SKBP Theme/Cluster mappings.",
    "05_MoA": "Mechanism of Action notes linked to targets, assets, and sources.",
    "06_Modalities_Platforms": "Modality and platform notes, including technology differentiation.",
    "07_Indications": "Disease and patient segment notes used for diligence and marketability.",
    "08_Competitors": "Competitor asset notes and similarity rationale.",
    "09_Evidence_Sources": "One note per evidence source URL or source claim.",
    "10_Scorecards": "Date-stamped scoring snapshots by asset.",
    "11_Themes_Clusters": "SKBP internal Theme and Cluster taxonomy.",
    "12_Dashboards": "Obsidian dashboard notes and Dataview-friendly index tables.",
    "13_Graph_Exports": "Graph export files for external analysis and UI reuse.",
    "90_Templates": "Markdown templates for future agent-generated notes.",
}

RELATIONSHIPS = {
    "OWNED_BY",
    "TARGETS",
    "HAS_MOA",
    "HAS_MODALITY",
    "HAS_INDICATION",
    "HAS_COMPETITOR",
    "USES_SOURCE",
    "HAS_SCORECARD",
    "MAPS_TO_THEME",
    "MAPS_TO_CLUSTER",
    "SUPPORTS_SCORE",
}


class WikiBuilder:
    def __init__(self) -> None:
        self.nodes: dict[str, dict[str, Any]] = {}
        self.edges: list[dict[str, Any]] = []
        self.asset_links_by_company: dict[str, set[str]] = defaultdict(set)
        self.asset_links_by_target: dict[str, set[str]] = defaultdict(set)
        self.asset_links_by_moa: dict[str, set[str]] = defaultdict(set)
        self.asset_links_by_modality: dict[str, set[str]] = defaultdict(set)
        self.asset_links_by_indication: dict[str, set[str]] = defaultdict(set)
        self.asset_links_by_theme: dict[str, set[str]] = defaultdict(set)
        self.asset_links_by_cluster: dict[str, set[str]] = defaultdict(set)
        self.source_links_by_id: dict[str, set[str]] = defaultdict(set)
        self.scorecards: list[dict[str, Any]] = []

    def add_node(self, node_id: str, label: str, node_type: str, title: str, **extra: Any) -> None:
        self.nodes[node_id] = {
            "id": node_id,
            "label": label,
            "type": node_type,
            "title": title,
            "tags": extra.get("tags", ""),
            "score": extra.get("score", ""),
            "recommendation": extra.get("recommendation", ""),
            "evidence_level": extra.get("evidence_level", ""),
        }

    def add_edge(
        self,
        source: str,
        target: str,
        relationship: str,
        evidence_type: str = "",
        source_note: str = "",
    ) -> None:
        if relationship not in RELATIONSHIPS:
            raise ValueError(f"Unsupported relationship: {relationship}")
        if not source or not target:
            return
        self.edges.append(
            {
                "source": source,
                "target": target,
                "relationship": relationship,
                "evidence_type": evidence_type,
                "source_note": source_note,
            }
        )


def safe_name(value: Any, fallback: str = "Untitled") -> str:
    text = str(value or fallback).strip()
    text = re.sub(r'[<>:"/\\|?*]', "_", text)
    text = re.sub(r"\s+", "_", text).strip("._")
    return text or fallback


def slug(value: Any, fallback: str = "unknown", max_length: int = 80) -> str:
    text = safe_name(value, fallback)
    text = re.sub(r"_+", "_", text)
    if len(text) > max_length:
        digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]
        text = f"{text[: max_length - 9].rstrip('_')}_{digest}"
    return text


def display(value: Any, fallback: str = "-") -> str:
    if value is None or value == "":
        return fallback
    if isinstance(value, list):
        return ", ".join(str(item) for item in value) if value else fallback
    return str(value)


def get(record: dict[str, Any], path: str, fallback: Any = "") -> Any:
    current: Any = record
    for key in path.split("."):
        if not isinstance(current, dict):
            return fallback
        current = current.get(key)
    return fallback if current is None else current


def md_cell(value: Any) -> str:
    return display(value).replace("\n", "<br>").replace("|", "\\|")


def bullet_list(items: Any, fallback: str = "None") -> str:
    if not isinstance(items, list) or not items:
        return f"- {fallback}"
    lines = []
    for item in items:
        if isinstance(item, dict):
            lines.append(f"- {display(item.get('fact') or item.get('evidence_summary') or item)}")
        else:
            lines.append(f"- {display(item)}")
    return "\n".join(lines)


def yaml_value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def frontmatter(items: dict[str, Any]) -> str:
    lines = ["---"]
    for key, value in items.items():
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {yaml_value(item)}")
        else:
            lines.append(f"{key}: {yaml_value(value)}")
    lines.append("---")
    return "\n".join(lines)


def wikilink(path_without_ext: str, label: str | None = None) -> str:
    if label and label != path_without_ext:
        return f"[[{path_without_ext}|{label}]]"
    return f"[[{path_without_ext}]]"


def note_path(folder: str, filename_without_ext: str) -> str:
    return f"{folder}/{filename_without_ext}"


def write_note(relative_path: str, content: str) -> None:
    path = VAULT_DIR / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def load_records() -> list[dict[str, Any]]:
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("records"), list):
        return data["records"]
    if isinstance(data, dict):
        return [data]
    raise ValueError("Unsupported pipeline records JSON format.")


def record_date(record: dict[str, Any]) -> str:
    raw = display(get(record, "meta.generated_at", date.today().isoformat()))
    match = re.search(r"\d{4}-\d{2}-\d{2}", raw)
    if match:
        return match.group(0).replace("-", "")
    match = re.search(r"\d{8}", raw)
    if match:
        return match.group(0)
    return date.today().strftime("%Y%m%d")


def asset_title(record: dict[str, Any]) -> str:
    return display(
        get(record, "json_summary.asset_name")
        or get(record, "structured_table.asset_name")
        or get(record, "input.asset_input")
        or get(record, "meta.output_filename_base"),
        "Unknown Asset",
    )


def company_title(record: dict[str, Any]) -> str:
    return display(
        get(record, "json_summary.company")
        or get(record, "structured_table.company")
        or get(record, "input.company_input"),
        "Unknown Company",
    )


def target_title(record: dict[str, Any]) -> str:
    return display(get(record, "json_summary.target") or get(record, "structured_table.target"), "Unknown Target")


def moa_title(record: dict[str, Any]) -> str:
    return display(
        get(record, "json_summary.moa")
        or get(record, "structured_table.moa")
        or get(record, "scoring.criteria.moa_validity.proposed_moa"),
        "Unknown MoA",
    )


def modality_title(record: dict[str, Any]) -> str:
    return display(
        get(record, "json_summary.modality_platform")
        or get(record, "structured_table.modality_platform")
        or get(record, "scoring.criteria.platform_attractiveness.modality_platform_identity"),
        "Unknown Modality",
    )


def indication_title(record: dict[str, Any]) -> str:
    return display(get(record, "json_summary.indication") or get(record, "structured_table.indication"), "Unknown Indication")


def theme_title(record: dict[str, Any]) -> str:
    return display(get(record, "json_summary.theme"), "No Theme")


def cluster_title(record: dict[str, Any]) -> str:
    return display(get(record, "json_summary.cluster"), "No mapped SKBP cluster")


def asset_file(record: dict[str, Any]) -> str:
    aliases = get(record, "obsidian.aliases", [])
    alias_suffix = ""
    if isinstance(aliases, list) and len(aliases) > 1:
        alias_suffix = "__" + slug(aliases[1])
    return "Asset__" + slug(asset_title(record)) + alias_suffix


def company_file(name: str) -> str:
    return "Company__" + slug(name)


def target_file(name: str) -> str:
    return "Target__" + slug(name)


def moa_file(name: str) -> str:
    return "MoA__" + slug(name)


def modality_file(name: str) -> str:
    return "Modality__" + slug(name)


def indication_file(name: str) -> str:
    return "Indication__" + slug(name)


def competitor_file(company: str, asset: str) -> str:
    return "Competitor__" + slug(company) + "__" + slug(asset)


def source_file(title: str, url: str | None = None) -> str:
    base = title or url or "Unknown_Source"
    return "Source__" + slug(base)[:120]


def scorecard_file(record: dict[str, Any]) -> str:
    return "Scorecard__" + slug(asset_title(record)) + "__" + record_date(record)


def theme_file(name: str) -> str:
    return "Theme__" + slug(name.replace("/", "-"))


def cluster_file(name: str) -> str:
    return "Cluster__" + slug(name.replace("/", "-"))


def node_id(kind: str, title: str) -> str:
    return f"{kind}::{slug(title).lower()}"


def evidence_level(record: dict[str, Any]) -> str:
    levels = []
    criteria = get(record, "scoring.criteria", {})
    if isinstance(criteria, dict):
        for item in criteria.values():
            if isinstance(item, dict):
                value = display(item.get("evidence_type"), "")
                match = re.match(r"E(\d)", value)
                if match:
                    levels.append(int(match.group(1)))
    return f"E{max(levels)}" if levels else "E0"


def criterion_rows(record: dict[str, Any]) -> str:
    criteria = get(record, "scoring.criteria", {})
    rows = ["| Criterion | Score | Evidence Type | One-line Judgment | Why Not Higher |", "|---|---:|---|---|---|"]
    for key, label in CRITERIA.items():
        item = criteria.get(key, {}) if isinstance(criteria, dict) else {}
        rows.append(
            "| "
            + " | ".join(
                [
                    label,
                    md_cell(item.get("score", "-")),
                    md_cell(item.get("evidence_type", "-")),
                    md_cell(item.get("main_line_summary", "-")),
                    md_cell(item.get("why_not_higher", "-")),
                ]
            )
            + " |"
        )
    return "\n".join(rows)


def source_items(record: dict[str, Any]) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(source: Any, default_title: str = "Evidence source") -> None:
        if isinstance(source, str):
            item = {"source_title": source, "source_url": source if source.startswith("http") else None, "source_type": "other"}
        elif isinstance(source, dict):
            item = dict(source)
        else:
            return
        url = item.get("source_url") or item.get("url")
        title = item.get("source_title") or item.get("title") or default_title
        key = str(url or title)
        if key in seen:
            return
        seen.add(key)
        item["source_title"] = title
        item["source_url"] = url
        item.setdefault("source_type", "other")
        item.setdefault("reliability", "medium" if url else "low")
        sources.append(item)

    for source in get(record, "structured_table.sources", []):
        add(source)
    for source in get(record, "validation.source_registry", []):
        add(source)
    for source in get(record, "competitive_analysis.competitor_table", []):
        if isinstance(source, dict) and source.get("source_url"):
            add(
                {
                    "source_title": f"{source.get('competitor_asset', 'Competitor')} source",
                    "source_url": source.get("source_url"),
                    "source_type": "other",
                    "evidence_summary": source.get("why_it_matters", ""),
                }
            )
    criteria = get(record, "scoring.criteria", {})
    if isinstance(criteria, dict):
        for label, item in criteria.items():
            if not isinstance(item, dict):
                continue
            for source in item.get("evidence_sources", []):
                add(source, f"{label} evidence")
    return sources


def render_raw_report(record: dict[str, Any]) -> tuple[str, str]:
    filename = safe_name(get(record, "meta.output_filename_base") or asset_title(record)) + ".md"
    raw = get(record, "source_report.raw_markdown", "")
    if not raw:
        raw = f"# {company_title(record)} Pipeline Scout Report: **{asset_title(record)}**\n\nRaw report was not provided in JSON."
    return filename, raw


def render_asset_note(record: dict[str, Any], raw_file: str) -> str:
    asset = asset_title(record)
    company = company_title(record)
    target = target_title(record)
    moa = moa_title(record)
    modality = modality_title(record)
    indication = indication_title(record)
    theme = theme_title(record)
    cluster = cluster_title(record)
    score_file = scorecard_file(record)
    source_links = [
        wikilink(note_path("09_Evidence_Sources", source_file(source.get("source_title", "Source"), source.get("source_url"))), source.get("source_title", "Source"))
        for source in source_items(record)[:10]
    ]
    aliases = get(record, "obsidian.aliases", [])
    tags = get(record, "obsidian.tags", [])
    if not isinstance(aliases, list):
        aliases = []
    if not isinstance(tags, list):
        tags = []
    fm = frontmatter(
        {
            "type": "asset",
            "canonical_id": node_id("asset", asset),
            "title": asset,
            "aliases": aliases,
            "tags": ["pipeline/asset", "skbp/pipeline_finder", f"theme/{slug(theme).lower()}"] + tags,
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
            "source_report": wikilink(note_path("01_Raw_Reports", raw_file[:-3])),
            "source_json": "json/pipeline-records.json",
            "status": "active",
            "confidence": "medium",
            "company": wikilink(note_path("03_Companies", company_file(company)), company),
            "target": wikilink(note_path("04_Targets", target_file(target)), target),
            "moa": wikilink(note_path("05_MoA", moa_file(moa)), moa),
            "modality": wikilink(note_path("06_Modalities_Platforms", modality_file(modality)), modality),
            "indications": [wikilink(note_path("07_Indications", indication_file(indication)), indication)],
            "scorecard": wikilink(note_path("10_Scorecards", score_file), score_file),
            "theme": wikilink(note_path("11_Themes_Clusters", theme_file(theme)), theme),
            "cluster": wikilink(note_path("11_Themes_Clusters", cluster_file(cluster)), cluster),
            "total_score": get(record, "scoring.total_score", 0),
            "max_score": get(record, "scoring.max_score", 21),
            "recommendation": get(record, "final_insight.recommendation", "Watch"),
            "evidence_level": evidence_level(record),
        }
    )
    return f"""{fm}

# {asset}

## 1. Snapshot

| Field | Value |
|---|---|
| Company | {wikilink(note_path("03_Companies", company_file(company)), company)} |
| Asset | {asset} |
| Target | {wikilink(note_path("04_Targets", target_file(target)), target)} |
| MoA | {wikilink(note_path("05_MoA", moa_file(moa)), moa)} |
| Modality | {wikilink(note_path("06_Modalities_Platforms", modality_file(modality)), modality)} |
| Indication | {wikilink(note_path("07_Indications", indication_file(indication)), indication)} |
| Stage | {md_cell(get(record, "structured_table.development_stage", "-"))} |
| Theme / Cluster | {wikilink(note_path("11_Themes_Clusters", theme_file(theme)), theme)} / {wikilink(note_path("11_Themes_Clusters", cluster_file(cluster)), cluster)} |
| Recommendation | {md_cell(get(record, "final_insight.recommendation", "Watch"))} |
| Total Score | {md_cell(get(record, "scoring.total_score", "-"))}/21 |

## 2. One-line Summary

{display(get(record, "final_insight.one_line_summary"), "-")}

## 3. Why This Asset Matters

- Strategic relevance: {md_cell(get(record, "scoring.criteria.target_relevance.main_line_summary", "-"))}
- Scientific rationale: {md_cell(get(record, "scoring.criteria.moa_validity.main_line_summary", "-"))}
- BD relevance: {md_cell(get(record, "final_insight.most_important_diligence_question", "-"))}

## 4. Scorecard

![[10_Scorecards/{score_file}]]

## 5. Knowledge Links

### Core Biology
- Target: {wikilink(note_path("04_Targets", target_file(target)), target)}
- MoA: {wikilink(note_path("05_MoA", moa_file(moa)), moa)}
- Theme: {wikilink(note_path("11_Themes_Clusters", theme_file(theme)), theme)}
- Cluster: {wikilink(note_path("11_Themes_Clusters", cluster_file(cluster)), cluster)}

### Development Context
- Company: {wikilink(note_path("03_Companies", company_file(company)), company)}
- Modality: {wikilink(note_path("06_Modalities_Platforms", modality_file(modality)), modality)}
- Indication: {wikilink(note_path("07_Indications", indication_file(indication)), indication)}

### Evidence Sources
{bullet_list(source_links, "No source notes linked")}

## 6. Key Diligence Questions

- {display(get(record, "final_insight.most_important_diligence_question"), "Confirm asset identity, rights, stage, and source quality.")}

## 7. Evidence Gaps

{bullet_list(get(record, "validation.uncertain_points", []))}

## 8. Score History

| Date | Total Score | Recommendation | Scorecard |
|---|---:|---|---|
| {record_date(record)} | {md_cell(get(record, "scoring.total_score", "-"))}/21 | {md_cell(get(record, "final_insight.recommendation", "Watch"))} | {wikilink(note_path("10_Scorecards", score_file), score_file)} |

## 9. Raw Report

Source report: {wikilink(note_path("01_Raw_Reports", raw_file[:-3]), raw_file[:-3])}
"""


def render_scorecard_note(record: dict[str, Any], raw_file: str) -> str:
    asset = asset_title(record)
    company = company_title(record)
    criteria = get(record, "scoring.criteria", {})
    market = criteria.get("marketability", {}) if isinstance(criteria, dict) else {}
    calculation = market.get("calculation", {}) if isinstance(market, dict) else {}
    a_step = calculation.get("A_targetable_addressable_patient", {}) if isinstance(calculation, dict) else {}
    b_step = calculation.get("B_unrisked_peak_sales", {}) if isinstance(calculation, dict) else {}
    c_step = calculation.get("C_obtainable_peak_sales", {}) if isinstance(calculation, dict) else {}
    details = []
    for key, label in CRITERIA.items():
        item = criteria.get(key, {}) if isinstance(criteria, dict) else {}
        details.append(
            f"""### {label}

- Score: {md_cell(item.get("score", "-"))}/3
- Evidence Type: {md_cell(item.get("evidence_type", "-"))}
- Reason: {md_cell(item.get("main_line_summary", "-"))}
- Evidence type reason: {md_cell(item.get("evidence_type_reason", "-"))}
- Why not higher: {md_cell(item.get("why_not_higher", "-"))}
- Uncertain points:
{bullet_list(item.get("uncertain_points", []), "None")}
"""
        )
    fm = frontmatter(
        {
            "type": "scorecard",
            "canonical_id": node_id("scorecard", f"{asset}::{record_date(record)}"),
            "title": f"Scorecard - {asset}",
            "tags": ["pipeline/scorecard", "skbp/scoring"],
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
            "source_report": wikilink(note_path("01_Raw_Reports", raw_file[:-3])),
            "source_json": "json/pipeline-records.json",
            "asset": wikilink(note_path("02_Assets", asset_file(record)), asset),
            "company": wikilink(note_path("03_Companies", company_file(company)), company),
            "total_score": get(record, "scoring.total_score", 0),
            "max_score": get(record, "scoring.max_score", 21),
            "recommendation": get(record, "final_insight.recommendation", "Watch"),
        }
    )
    return f"""{fm}

# Scorecard - {asset}

## 1. Score Summary

{criterion_rows(record)}

| Total | Value |
|---|---:|
| Total Score | {md_cell(get(record, "scoring.total_score", "-"))}/21 |
| Recommendation | {md_cell(get(record, "final_insight.recommendation", "Watch"))} |
| Hard Filter | {md_cell(get(record, "hard_filter.status") or get(record, "hard_filter.overall_result", "-"))} |

## 2. Criterion Details

{chr(10).join(details)}

## 3. Evidence Types

Linked criteria: {wikilink(note_path("00_System", "Evidence_Type_Guide"), "Evidence Type Guide")}

## 4. Marketability Calculation

| Step | Formula / Inputs | Output |
|---|---|---:|
| A. TAP | {md_cell(a_step.get("formula", "-"))} | {md_cell(a_step.get("targetable_addressable_patient", "-"))} |
| B. Unrisked Peak Sales | {md_cell(b_step.get("formula", "-"))} | {md_cell(b_step.get("unrisked_peak_sales", "-"))} million USD |
| C. Obtainable Peak Sales | {md_cell(c_step.get("formula", "-"))} | {md_cell(c_step.get("obtainable_peak_sales", "-"))} million USD |

Commercial rationale status: `{md_cell(calculation.get("commercial_rationale_status", "-"))}`

## 5. Data Maturity Stage Alignment

- Claimed stage: {md_cell(get(record, "scoring.criteria.data_maturity.claimed_development_stage", "-"))}
- Expected data for stage: {md_cell(get(record, "scoring.criteria.data_maturity.expected_data_for_stage", "-"))}
- Visible data: {md_cell(get(record, "scoring.criteria.data_maturity.visible_asset_specific_data", "-"))}
- Missing data: {md_cell(get(record, "scoring.criteria.data_maturity.missing_data", "-"))}

## 6. Final Recommendation

{display(get(record, "final_insight.one_line_summary"), "-")}
"""


def render_company_note(name: str, asset_files: set[str], records: list[dict[str, Any]]) -> str:
    sample = next((record for record in records if company_title(record) == name), {})
    fm = frontmatter(
        {
            "type": "company",
            "canonical_id": node_id("company", name),
            "title": name,
            "aliases": [name],
            "tags": ["pipeline/company"],
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
            "source_report": None,
            "source_json": "json/pipeline-records.json",
            "status": "active",
            "confidence": "medium",
        }
    )
    return f"""{fm}

# {name}

## Profile

| Field | Value |
|---|---|
| Country | {md_cell(get(sample, "json_summary.company_country") or get(sample, "structured_table.company_country", "-"))} |
| Headquarters | {md_cell(get(sample, "company_profile.headquarters", "-"))} |
| Website | {md_cell(get(sample, "company_profile.website", "-"))} |
| Company stage | {md_cell(get(sample, "company_profile.company_stage", "-"))} |
| Focus areas | {md_cell(get(sample, "company_profile.focus_areas", "-"))} |

## Pipeline Assets

{bullet_list([wikilink(note_path("02_Assets", item), item.replace("Asset__", "")) for item in sorted(asset_files)])}

## Platform / Technology

- {md_cell(modality_title(sample))}

## Financing / Partnership Signals

- {md_cell(get(sample, "company_profile.financing_partnership_signals", "-"))}

## Evidence Sources

{bullet_list([wikilink(note_path("09_Evidence_Sources", source_file(source.get("source_title", "Source"), source.get("source_url"))), source.get("source_title", "Source")) for source in source_items(sample)[:5]])}

## Notes

- Company note is generated from Pipeline Finder JSON and should not contain asset-specific scores.
"""


def render_target_note(name: str, asset_files: set[str], records: list[dict[str, Any]]) -> str:
    sample = next((record for record in records if target_title(record) == name), {})
    theme = theme_title(sample)
    cluster = cluster_title(sample)
    fm = frontmatter(
        {
            "type": "target",
            "canonical_id": node_id("target", name),
            "title": name,
            "aliases": [name],
            "tags": ["pipeline/target", f"theme/{slug(theme).lower()}"],
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
            "source_report": None,
            "source_json": "json/pipeline-records.json",
            "status": "active",
            "confidence": "medium",
        }
    )
    return f"""{fm}

# {name}

## Biology Summary

{md_cell(get(sample, "scoring.criteria.target_relevance.main_line_summary", "-"))}

## SKBP Mapping

| Field | Value |
|---|---|
| Theme | {wikilink(note_path("11_Themes_Clusters", theme_file(theme)), theme)} |
| Cluster | {wikilink(note_path("11_Themes_Clusters", cluster_file(cluster)), cluster)} |
| Relevance | {md_cell(get(sample, "scoring.criteria.target_relevance.main_line_summary", "-"))} |

## Related Assets

{bullet_list([wikilink(note_path("02_Assets", item), item.replace("Asset__", "")) for item in sorted(asset_files)])}

## Related MoA

- {wikilink(note_path("05_MoA", moa_file(moa_title(sample))), moa_title(sample))}

## Disease Links

- {wikilink(note_path("07_Indications", indication_file(indication_title(sample))), indication_title(sample))}

## Key Evidence

{bullet_list(get(sample, "scoring.criteria.target_relevance.evidence_trail", []))}
"""


def render_simple_entity_note(kind: str, name: str, asset_files: set[str], records: list[dict[str, Any]]) -> str:
    sample = records[0] if records else {}
    folder_map = {
        "moa": "05_MoA",
        "modality": "06_Modalities_Platforms",
        "indication": "07_Indications",
    }
    title_map = {
        "moa": "Mechanism Summary",
        "modality": "Modality / Platform Summary",
        "indication": "Disease Overview",
    }
    file_map = {
        "moa": moa_file,
        "modality": modality_file,
        "indication": indication_file,
    }
    fm = frontmatter(
        {
            "type": kind,
            "canonical_id": node_id(kind, name),
            "title": name,
            "aliases": [name],
            "tags": [f"pipeline/{kind}"],
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
            "source_report": None,
            "source_json": "json/pipeline-records.json",
            "status": "active",
            "confidence": "medium",
        }
    )
    source_links = [wikilink(note_path("09_Evidence_Sources", source_file(source.get("source_title", "Source"), source.get("source_url"))), source.get("source_title", "Source")) for source in source_items(sample)[:5]]
    return f"""{fm}

# {name}

## {title_map[kind]}

{md_cell(get(sample, "scoring.criteria.moa_validity.main_line_summary" if kind == "moa" else "scoring.criteria.platform_attractiveness.main_line_summary" if kind == "modality" else "scoring.criteria.marketability.main_line_summary", "-"))}

## Related Assets

{bullet_list([wikilink(note_path("02_Assets", item), item.replace("Asset__", "")) for item in sorted(asset_files)])}

## Related Targets / MoA

- Target: {wikilink(note_path("04_Targets", target_file(target_title(sample))), target_title(sample))}
- MoA: {wikilink(note_path("05_MoA", moa_file(moa_title(sample))), moa_title(sample))}

## Supporting Evidence

{bullet_list(source_links)}

## Limitations

{bullet_list(get(sample, "validation.uncertain_points", []))}
"""


def render_competitor_note(comp: dict[str, Any], reviewed_asset_file: str) -> tuple[str, str]:
    asset = display(comp.get("competitor_asset") or comp.get("asset") or comp.get("competitor_name"), "Unknown Competitor")
    company = display(comp.get("company"), "Unknown Company")
    filename = competitor_file(company, asset)
    fm = frontmatter(
        {
            "type": "competitor",
            "canonical_id": node_id("competitor", f"{company}::{asset}"),
            "title": asset,
            "aliases": [asset],
            "tags": ["pipeline/competitor"],
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
            "source_report": None,
            "source_json": "json/pipeline-records.json",
            "status": "active",
            "confidence": "medium" if comp.get("source_url") else "low",
        }
    )
    content = f"""{fm}

# {asset}

## Competitor Snapshot

| Field | Value |
|---|---|
| Company | {md_cell(company)} |
| Asset | {md_cell(asset)} |
| Target / MoA | {md_cell(comp.get("target_or_moa", "-"))} |
| Modality | {md_cell(comp.get("modality", "-"))} |
| Stage | {md_cell(comp.get("stage", "-"))} |
| Similarity level | {md_cell(comp.get("similarity_level", "-"))} |

## Why It Matters

{md_cell(comp.get("why_it_matters", "-"))}

## Similarity to Reviewed Assets

- {wikilink(note_path("02_Assets", reviewed_asset_file), reviewed_asset_file.replace("Asset__", ""))}: {md_cell(comp.get("relevance_to_asset") or comp.get("why_it_matters", "-"))}

## Sources

- {display(comp.get("source_url"), "No URL provided")}
"""
    return filename, content


def render_source_note(source: dict[str, Any], used_in: set[str]) -> tuple[str, str]:
    title = display(source.get("source_title") or source.get("title") or source.get("source_url"), "Unknown Source")
    url = source.get("source_url")
    filename = source_file(title, url)
    fm = frontmatter(
        {
            "type": "source",
            "canonical_id": f"source::{slug(url or title).lower()}",
            "title": title,
            "aliases": [title],
            "tags": ["pipeline/source", f"source/{slug(source.get('source_type', 'other')).lower()}"],
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
            "source_report": None,
            "source_json": "json/pipeline-records.json",
            "status": "active",
            "confidence": "medium" if url else "low",
        }
    )
    return filename, f"""{fm}

# {title}

## Source Metadata

| Field | Value |
|---|---|
| Source type | {md_cell(source.get("source_type", "other"))} |
| Reliability | {md_cell(source.get("reliability", "medium" if url else "low"))} |
| URL | {md_cell(url or "No URL provided")} |
| Accessed / generated date | {date.today().isoformat()} |

## Evidence Summary

{md_cell(source.get("evidence_summary") or source.get("source_excerpt") or "-")}

## Used In

{bullet_list([wikilink(item, item.split("/")[-1]) for item in sorted(used_in)])}

## Extracted Claims

- {md_cell(source.get("relevance_to_assessment", "-"))}

## Caution / Limitations

- Source note is generated from structured JSON. Verify primary source context before using for investment decisions.
"""


def render_theme_cluster_note(kind: str, name: str, asset_files: set[str]) -> str:
    is_theme = kind == "theme"
    fm = frontmatter(
        {
            "type": kind,
            "canonical_id": node_id(kind, name),
            "title": name,
            "aliases": [name],
            "tags": [f"skbp/{kind}", "skbp/taxonomy"],
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
            "source_report": None,
            "source_json": "json/pipeline-records.json",
            "status": "active",
            "confidence": "high",
        }
    )
    definition = (
        "A cross-disease strategic biology theme used for SKBP Theme-based R&D strategy."
        if is_theme
        else "A reusable biology axis under a Theme that supports repeated target discovery and asset translation."
    )
    return f"""{fm}

# {name}

## Definition

{definition}

## Included Biology

- Generated from current Pipeline Finder records.

## Related Targets

- See linked asset and target notes.

## Related Assets

{bullet_list([wikilink(note_path("02_Assets", item), item.replace("Asset__", "")) for item in sorted(asset_files)])}

## Notes

- Allowed Theme values include E/I Balance, Neuroimmune, and No Theme.
- Cluster values must match the scoring criteria taxonomy.
"""


def write_system_notes() -> None:
    full_text = SCORING_FULL.read_text(encoding="utf-8") if SCORING_FULL.exists() else "# Scoring Criteria v3.1\n"
    display_text = SCORING_DISPLAY.read_text(encoding="utf-8") if SCORING_DISPLAY.exists() else "# Scoring Criteria v3.1 Display\n"
    write_note("00_System/Scoring_Criteria_v3.1_Full.md", full_text)
    write_note("00_System/Scoring_Criteria_v3.1_Display.md", display_text)
    write_note(
        "00_System/Evidence_Type_Guide.md",
        """# Evidence Type Guide

| Type | Meaning |
|---|---|
| E0 | Not found or not assessable |
| E1 | Company claim or scientific rationale only |
| E2 | Indirect or class-level evidence |
| E3 | Asset-specific preclinical or technical evidence |
| E4 | Asset-specific clinical evidence |
""",
    )
    write_note(
        "00_System/Theme_Cluster_Taxonomy.md",
        """# Theme / Cluster Taxonomy

## Themes

- E/I Balance
- Neuroimmune
- No Theme

## E/I Balance Clusters

- Ion Channel
- Inhibitory Tone 강화
- Synaptic Transmission
- Chloride Homeostasis
- Network Modulation

## Neuroimmune Clusters

- CNS 손상 면역반응
- 교세포 항상성
- Cytokine 신경조절
- 손상/질환 면역조절
- 말초 면역기관 연결
""",
    )
    write_note(
        "00_System/Wiki_Generation_Rules.md",
        """# Wiki Generation Rules

1. Treat `json/pipeline-records.json` as the single source of truth.
2. Preserve raw Markdown reports in `01_Raw_Reports/`.
3. Generate separate notes for assets, companies, targets, MoA, modalities, indications, competitors, sources, scorecards, themes, and clusters.
4. Use deterministic filenames with entity type prefixes.
5. Every important relation should be represented as an Obsidian wikilink and as a graph edge.
6. Do not upgrade evidence type or score without source-level support.
7. Re-run `python scripts/export_pipeline_wiki.py` after JSON changes.
""",
    )
    write_note(
        "00_System/Obsidian_Graph_Group_Guide.md",
        """# Obsidian Graph Group Guide

Recommended groups:

- path:02_Assets -> Asset nodes
- path:03_Companies -> Company nodes
- path:04_Targets -> Target nodes
- path:05_MoA -> MoA nodes
- path:07_Indications -> Indication nodes
- path:08_Competitors -> Competitor nodes
- path:09_Evidence_Sources -> Source nodes
- path:11_Themes_Clusters -> Theme / Cluster nodes
""",
    )


def write_claude_files() -> None:
    for folder, purpose in FOLDERS.items():
        write_note(
            f"{folder}/CLAUDE.md",
            f"""# CLAUDE.md - {folder}

## Purpose

{purpose}

## Naming Rule

- Use deterministic filenames with entity type prefixes.
- Replace spaces with `_`.
- Replace file-system unsafe characters with `_`.
- Preserve aliases in frontmatter.

## Required Frontmatter

- type
- canonical_id
- title
- aliases
- tags
- created_at
- updated_at
- source_report
- source_json
- status
- confidence

## Link Rules

- Use Obsidian wikilinks for every major relationship.
- Asset notes are the graph hub and should link back to all related notes.
- Entity notes should include backlinks to related assets.

## Validation Rules

- Do not leave broken wikilinks.
- Do not promote class-level evidence to asset-specific evidence.
- Scores must be exact integers 0, 1, 2, or 3.
- Source URLs should be captured as source notes whenever available.

## Do Not

- Do not overwrite raw report meaning.
- Do not invent sources.
- Do not create duplicate entity notes for aliases of the same asset or company.
""",
        )


def write_templates() -> None:
    templates = {
        "Template__Asset.md": "# {{asset_name}}\n\n## Snapshot\n\n## Scorecard\n\n## Evidence Gaps\n",
        "Template__Company.md": "# {{company_name}}\n\n## Profile\n\n## Pipeline Assets\n",
        "Template__Target.md": "# {{target}}\n\n## Biology Summary\n\n## SKBP Mapping\n",
        "Template__MoA.md": "# {{moa}}\n\n## Mechanism Summary\n\n## Functional Evidence\n",
        "Template__Modality.md": "# {{modality}}\n\n## Technical Differentiation\n",
        "Template__Indication.md": "# {{indication}}\n\n## Patient Segmentation\n",
        "Template__Competitor.md": "# {{competitor_asset}}\n\n## Competitor Snapshot\n",
        "Template__Source.md": "# {{source_title}}\n\n## Source Metadata\n",
        "Template__Scorecard.md": "# Scorecard - {{asset_name}}\n\n## Score Summary\n",
    }
    for filename, content in templates.items():
        write_note(f"90_Templates/{filename}", content)


def write_dashboard_notes(builder: WikiBuilder) -> None:
    asset_nodes = [node for node in builder.nodes.values() if node["type"] == "asset"]
    rows = ["| Asset | Score | Recommendation | Evidence Level |", "|---|---:|---|---|"]
    for node in sorted(asset_nodes, key=lambda item: item["label"]):
        rows.append(
            f"| {wikilink(note_path('02_Assets', node['title']), node['label'])} | {node['score']} | {node['recommendation']} | {node['evidence_level']} |"
        )
    write_note("12_Dashboards/Dashboard__Asset_Index.md", "# Asset Index\n\n" + "\n".join(rows))
    write_note(
        "12_Dashboards/Dashboard__Shortlist.md",
        "# Shortlist\n\n" + "\n".join([rows[0], rows[1]] + [row for row in rows[2:] if "Shortlist" in row]),
    )
    write_note(
        "12_Dashboards/Dashboard__Watchlist.md",
        "# Watchlist\n\n" + "\n".join([rows[0], rows[1]] + [row for row in rows[2:] if "Watch" in row]),
    )
    write_note(
        "12_Dashboards/Dashboard__By_Target.md",
        "# By Target\n\n"
        + "\n".join(
            f"- {wikilink(note_path('04_Targets', target_file(target.split('::', 1)[-1])), target.split('::', 1)[-1])}"
            for target in sorted(builder.asset_links_by_target)
        ),
    )
    write_note(
        "12_Dashboards/Dashboard__By_Theme.md",
        "# By Theme\n\n"
        + "\n".join(
            f"- {wikilink(note_path('11_Themes_Clusters', theme_file(theme.split('::', 1)[-1])), theme.split('::', 1)[-1])}"
            for theme in sorted(builder.asset_links_by_theme)
        ),
    )
    write_note(
        "12_Dashboards/Dashboard__Evidence_Gaps.md",
        "# Evidence Gaps\n\nReview assets or criteria with E0/E1 evidence, weak Data Maturity, or unresolved Marketability rationale.\n",
    )
    write_note(
        "12_Dashboards/Dashboard__Competitor_Map.md",
        "# Competitor Map\n\n"
        + "\n".join(
            f"- {edge['source']} -> {edge['target']}"
            for edge in builder.edges
            if edge["relationship"] == "HAS_COMPETITOR"
        ),
    )


def write_graph_exports(builder: WikiBuilder) -> None:
    export_dir = VAULT_DIR / "13_Graph_Exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    with (export_dir / "nodes.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["id", "label", "type", "title", "tags", "score", "recommendation", "evidence_level"],
        )
        writer.writeheader()
        writer.writerows(builder.nodes.values())
    with (export_dir / "edges.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["source", "target", "relationship", "evidence_type", "source_note"])
        writer.writeheader()
        writer.writerows(builder.edges)
    (export_dir / "graph.json").write_text(
        json.dumps({"nodes": list(builder.nodes.values()), "edges": builder.edges}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def validate_vault(builder: WikiBuilder) -> list[str]:
    warnings: list[str] = []
    for edge in builder.edges:
        if edge["source"] not in builder.nodes:
            warnings.append(f"Missing edge source node: {edge['source']}")
        if edge["target"] not in builder.nodes:
            warnings.append(f"Missing edge target node: {edge['target']}")
    for folder in FOLDERS:
        if not (VAULT_DIR / folder / "CLAUDE.md").exists():
            warnings.append(f"Missing CLAUDE.md in {folder}")
    return warnings


def generate() -> dict[str, Any]:
    records = load_records()
    if VAULT_DIR.exists():
        shutil.rmtree(VAULT_DIR)
    for folder in FOLDERS:
        (VAULT_DIR / folder).mkdir(parents=True, exist_ok=True)

    builder = WikiBuilder()
    write_system_notes()
    write_claude_files()
    write_templates()

    for record in records:
        raw_file, raw_content = render_raw_report(record)
        write_note(f"01_Raw_Reports/{raw_file}", raw_content)

        asset = asset_title(record)
        company = company_title(record)
        target = target_title(record)
        moa = moa_title(record)
        modality = modality_title(record)
        indication = indication_title(record)
        theme = theme_title(record)
        cluster = cluster_title(record)
        asset_filename = asset_file(record)
        score_filename = scorecard_file(record)

        asset_id = node_id("asset", asset)
        company_id = node_id("company", company)
        target_id = node_id("target", target)
        moa_id = node_id("moa", moa)
        modality_id = node_id("modality", modality)
        indication_id = node_id("indication", indication)
        theme_id = node_id("theme", theme)
        cluster_id = node_id("cluster", cluster)
        scorecard_id = node_id("scorecard", f"{asset}::{record_date(record)}")

        builder.add_node(
            asset_id,
            asset,
            "asset",
            asset_filename,
            tags=f"pipeline/asset;theme/{slug(theme).lower()}",
            score=get(record, "scoring.total_score", ""),
            recommendation=get(record, "final_insight.recommendation", "Watch"),
            evidence_level=evidence_level(record),
        )
        builder.add_node(company_id, company, "company", company_file(company), tags="pipeline/company")
        builder.add_node(target_id, target, "target", target_file(target), tags="pipeline/target")
        builder.add_node(moa_id, moa, "moa", moa_file(moa), tags="pipeline/moa")
        builder.add_node(modality_id, modality, "modality", modality_file(modality), tags="pipeline/modality")
        builder.add_node(indication_id, indication, "indication", indication_file(indication), tags="pipeline/indication")
        builder.add_node(theme_id, theme, "theme", theme_file(theme), tags="skbp/theme")
        builder.add_node(cluster_id, cluster, "cluster", cluster_file(cluster), tags="skbp/cluster")
        builder.add_node(
            scorecard_id,
            f"Scorecard - {asset}",
            "scorecard",
            score_filename,
            tags="pipeline/scorecard",
            score=get(record, "scoring.total_score", ""),
            recommendation=get(record, "final_insight.recommendation", "Watch"),
            evidence_level=evidence_level(record),
        )

        evidence = evidence_level(record)
        builder.add_edge(asset_id, company_id, "OWNED_BY", evidence, score_filename)
        builder.add_edge(asset_id, target_id, "TARGETS", evidence, score_filename)
        builder.add_edge(asset_id, moa_id, "HAS_MOA", evidence, score_filename)
        builder.add_edge(asset_id, modality_id, "HAS_MODALITY", evidence, score_filename)
        builder.add_edge(asset_id, indication_id, "HAS_INDICATION", evidence, score_filename)
        builder.add_edge(asset_id, theme_id, "MAPS_TO_THEME", evidence, score_filename)
        builder.add_edge(asset_id, cluster_id, "MAPS_TO_CLUSTER", evidence, score_filename)
        builder.add_edge(asset_id, scorecard_id, "HAS_SCORECARD", evidence, score_filename)

        builder.asset_links_by_company[company_id].add(asset_filename)
        builder.asset_links_by_target[target_id].add(asset_filename)
        builder.asset_links_by_moa[moa_id].add(asset_filename)
        builder.asset_links_by_modality[modality_id].add(asset_filename)
        builder.asset_links_by_indication[indication_id].add(asset_filename)
        builder.asset_links_by_theme[theme_id].add(asset_filename)
        builder.asset_links_by_cluster[cluster_id].add(asset_filename)

        write_note(f"02_Assets/{asset_filename}.md", render_asset_note(record, raw_file))
        write_note(f"10_Scorecards/{score_filename}.md", render_scorecard_note(record, raw_file))

        for comp in get(record, "competitive_analysis.competitor_table", []):
            if not isinstance(comp, dict):
                continue
            comp_filename, comp_content = render_competitor_note(comp, asset_filename)
            comp_title = display(comp.get("competitor_asset") or comp.get("asset") or comp.get("competitor_name"), comp_filename)
            comp_id = node_id("competitor", f"{display(comp.get('company'), 'Unknown Company')}::{comp_title}")
            builder.add_node(comp_id, comp_title, "competitor", comp_filename, tags="pipeline/competitor")
            builder.add_edge(asset_id, comp_id, "HAS_COMPETITOR", evidence, score_filename)
            write_note(f"08_Competitors/{comp_filename}.md", comp_content)

        for source in source_items(record):
            source_title = display(source.get("source_title") or source.get("source_url"), "Unknown Source")
            source_note_name = source_file(source_title, source.get("source_url"))
            source_id = f"source::{slug(source.get('source_url') or source_title).lower()}"
            builder.add_node(
                source_id,
                source_title,
                "source",
                source_note_name,
                tags=f"pipeline/source;source/{slug(source.get('source_type', 'other')).lower()}",
                evidence_level=evidence,
            )
            builder.add_edge(asset_id, source_id, "USES_SOURCE", evidence, source_note_name)
            builder.add_edge(scorecard_id, source_id, "SUPPORTS_SCORE", evidence, source_note_name)
            builder.source_links_by_id[source_id].add(note_path("02_Assets", asset_filename))
            builder.source_links_by_id[source_id].add(note_path("10_Scorecards", score_filename))
            write_note(f"09_Evidence_Sources/{source_note_name}.md", render_source_note(source, builder.source_links_by_id[source_id])[1])

    records_by_company = defaultdict(list)
    records_by_target = defaultdict(list)
    records_by_moa = defaultdict(list)
    records_by_modality = defaultdict(list)
    records_by_indication = defaultdict(list)
    for record in records:
        records_by_company[company_title(record)].append(record)
        records_by_target[target_title(record)].append(record)
        records_by_moa[moa_title(record)].append(record)
        records_by_modality[modality_title(record)].append(record)
        records_by_indication[indication_title(record)].append(record)

    for key, assets in builder.asset_links_by_company.items():
        name = key.split("::", 1)[1]
        write_note(f"03_Companies/{company_file(name)}.md", render_company_note(name, assets, records_by_company[name]))
    for key, assets in builder.asset_links_by_target.items():
        name = key.split("::", 1)[1]
        write_note(f"04_Targets/{target_file(name)}.md", render_target_note(name, assets, records_by_target[name]))
    for key, assets in builder.asset_links_by_moa.items():
        name = key.split("::", 1)[1]
        write_note(f"05_MoA/{moa_file(name)}.md", render_simple_entity_note("moa", name, assets, records_by_moa[name]))
    for key, assets in builder.asset_links_by_modality.items():
        name = key.split("::", 1)[1]
        write_note(
            f"06_Modalities_Platforms/{modality_file(name)}.md",
            render_simple_entity_note("modality", name, assets, records_by_modality[name]),
        )
    for key, assets in builder.asset_links_by_indication.items():
        name = key.split("::", 1)[1]
        write_note(
            f"07_Indications/{indication_file(name)}.md",
            render_simple_entity_note("indication", name, assets, records_by_indication[name]),
        )
    for key, assets in builder.asset_links_by_theme.items():
        name = key.split("::", 1)[1]
        write_note(f"11_Themes_Clusters/{theme_file(name)}.md", render_theme_cluster_note("theme", name, assets))
    for key, assets in builder.asset_links_by_cluster.items():
        name = key.split("::", 1)[1]
        write_note(f"11_Themes_Clusters/{cluster_file(name)}.md", render_theme_cluster_note("cluster", name, assets))

    write_dashboard_notes(builder)
    write_graph_exports(builder)
    warnings = validate_vault(builder)
    report = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "records": len(records),
        "nodes": len(builder.nodes),
        "edges": len(builder.edges),
        "warnings": warnings,
    }
    write_note(
        "13_Graph_Exports/validation_report.md",
        "# Wiki Validation Report\n\n```json\n" + json.dumps(report, ensure_ascii=False, indent=2) + "\n```\n",
    )
    write_note(
        "README.md",
        f"""# SKBP Pipeline Wiki

Generated from `json/pipeline-records.json`.

Generated at: `{report["generated_at"]}`

## Entry Points

- [[12_Dashboards/Dashboard__Asset_Index]]
- [[12_Dashboards/Dashboard__By_Target]]
- [[12_Dashboards/Dashboard__By_Theme]]
- [[12_Dashboards/Dashboard__Evidence_Gaps]]
- [[00_System/Wiki_Generation_Rules]]

## Counts

- Records: {report["records"]}
- Graph nodes: {report["nodes"]}
- Graph edges: {report["edges"]}

## Rule

Edit JSON first, then regenerate this vault with:

```powershell
python scripts\\export_pipeline_wiki.py
```
""",
    )
    return report


if __name__ == "__main__":
    result = generate()
    print(json.dumps(result, ensure_ascii=False, indent=2))
