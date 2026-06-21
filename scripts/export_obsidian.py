from __future__ import annotations

import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "json" / "pipeline-records.json"
OUTPUT_DIR = ROOT / "obsidian"
MANAGED_DIRS = ["Assets", "Companies", "Themes", "Clusters"]


def safe_name(value: Any, fallback: str = "Untitled") -> str:
    text = str(value or fallback).strip()
    text = re.sub(r'[<>:"/\\\\|?*]', "-", text)
    text = re.sub(r"\s+", " ", text).strip(" .")
    return text or fallback


def wikilink(name: str, label: str | None = None) -> str:
    safe = safe_name(name)
    return f"[[{safe}|{label}]]" if label and label != safe else f"[[{safe}]]"


def get(record: dict[str, Any], path: str, fallback: Any = "") -> Any:
    current: Any = record
    for key in path.split("."):
        if not isinstance(current, dict):
            return fallback
        current = current.get(key)
    return fallback if current is None else current


def write_note(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def frontmatter(items: dict[str, Any]) -> str:
    lines = ["---"]
    for key, value in items.items():
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {json.dumps(item, ensure_ascii=False)}")
        else:
            lines.append(f"{key}: {json.dumps(value, ensure_ascii=False)}")
    lines.append("---")
    return "\n".join(lines)


def md_cell(value: Any) -> str:
    text = str(value if value is not None else "-")
    return text.replace("\n", " ").replace("|", "\\|")


def million_usd(value: Any, unit: Any = "") -> str:
    if value in (None, ""):
        return "-"
    if isinstance(value, (int, float)):
        amount = value if str(unit).lower() == "million usd" else value / 1_000_000
        return f"USD {amount:,.1f}M"
    return str(value)


def score_table(record: dict[str, Any]) -> str:
    criteria = get(record, "scoring.criteria", {})
    rubric = get(record, "rubric", {})
    labels = {
        "target_relevance": "Target Relevance",
        "competitive_landscape": "Competitive Landscape",
        "moa_validity": "MoA Validity",
        "platform_attractiveness": "Platform Attractiveness",
        "expansion_potential": "Expansion Potential",
        "data_maturity": "Data Maturity",
        "marketability": "Marketability",
    }
    rows = ["| Criterion | Score | Rubric Definition | Judgment Reason | Evidence Sources |", "|---|---:|---|---|---|"]
    for key, label in labels.items():
        item = criteria.get(key, {}) if isinstance(criteria, dict) else {}
        definition = rubric.get(key, {}) if isinstance(rubric, dict) else {}
        score = item.get("score") if isinstance(item, dict) else None
        evidence_sources = item.get("evidence_sources", []) if isinstance(item, dict) else []
        source_titles = []
        for source in evidence_sources[:3]:
            if isinstance(source, dict):
                title = source.get("source_title") or "-"
                url = source.get("source_url")
                source_titles.append(f"{title} ({url})" if url else title)
        rows.append(
            "| "
            + " | ".join(
                [
                    md_cell(label),
                    md_cell(score if score is not None else "-"),
                    md_cell((definition.get("score_definitions") or {}).get(str(score), "-")),
                    md_cell(item.get("main_line_summary") or item.get("reason", "-")),
                    md_cell("<br>".join(source_titles) if source_titles else "-"),
                ]
            )
            + " |"
        )
    return "\n".join(rows)


def source_table(sources: list[Any]) -> str:
    rows = [
        "| Source | Type | Reliability | Supports Score | Evidence Summary | URL |",
        "|---|---|---|---|---|---|",
    ]
    for source in sources:
        if not isinstance(source, dict):
            continue
        url = source.get("source_url")
        rows.append(
            "| "
            + " | ".join(
                [
                    md_cell(source.get("source_title", "-")),
                    md_cell(source.get("source_type", "-")),
                    md_cell(source.get("reliability", "-")),
                    md_cell(source.get("supports_score", "-")),
                    md_cell(source.get("evidence_summary", "-")),
                    md_cell(url if url else "-"),
                ]
            )
            + " |"
        )
    if len(rows) == 2:
        rows.append("| None | - | - | - | - | - |")
    return "\n".join(rows)


def marketability_calculation_table(calculation: dict[str, Any]) -> str:
    if not isinstance(calculation, dict):
        return ""
    step_a = calculation.get("A_targetable_addressable_patient", {}) or {}
    step_b = calculation.get("B_unrisked_peak_sales", {}) or {}
    step_c = calculation.get("C_obtainable_peak_sales", {}) or {}
    entry = step_b.get("entry_order_share_assumption", {}) or {}
    rows = [
        "| Step | Inputs / Assumptions | Formula | Output |",
        "|---|---|---|---|",
        "| A. TAP | "
        + md_cell(
            f"Total patients: {step_a.get('total_patient_pool', '-')}; "
            f"Diagnosis: {step_a.get('diagnosis_rate', '-')}; "
            f"Eligibility: {step_a.get('eligibility_rate', '-')}; "
            f"Biomarker: {step_a.get('biomarker_positive_rate', '-')}; "
            f"Treatable subgroup: {step_a.get('treatable_subgroup_rate', '-')}"
        )
        + " | "
        + md_cell(step_a.get("formula", "-"))
        + " | "
        + md_cell(step_a.get("targetable_addressable_patient", "-"))
        + " |",
        "| B. Unrisked Peak Sales | "
        + md_cell(
            f"TAP: {step_b.get('tap', '-')}; "
            f"Annual net price: {step_b.get('annual_net_price', '-')}; "
            f"Peak penetration: {step_b.get('peak_penetration', '-')}; "
            f"Duration factor: {step_b.get('treatment_duration_factor', '-')}; "
            f"Entry/share: {entry.get('matrix_share_reference', '-')}"
        )
        + " | "
        + md_cell(step_b.get("formula", "-"))
        + " | "
        + md_cell(million_usd(step_b.get("unrisked_peak_sales"), step_b.get("sales_unit")))
        + " |",
        "| C. Obtainable Peak Sales | "
        + md_cell(
            f"Competition haircut: {step_c.get('competition_haircut', '-')}; "
            f"Pricing power: {step_c.get('pricing_power_adjustment', '-')}; "
            f"Expansion: {step_c.get('expansion_capacity_adjustment', '-')}"
        )
        + " | "
        + md_cell(step_c.get("formula", "-"))
        + " | "
        + md_cell(million_usd(step_c.get("obtainable_peak_sales"), step_c.get("sales_unit")))
        + " |",
    ]
    return "\n".join(rows)


def scoring_rationale_sections(record: dict[str, Any]) -> str:
    criteria = get(record, "scoring.criteria", {})
    rubric = get(record, "rubric", {})
    labels = {
        "target_relevance": "Target Relevance",
        "competitive_landscape": "Competitive Landscape",
        "moa_validity": "MoA Validity",
        "platform_attractiveness": "Platform Attractiveness",
        "expansion_potential": "Expansion Potential",
        "data_maturity": "Data Maturity",
        "marketability": "Marketability",
    }
    sections: list[str] = []
    for key, label in labels.items():
        item = criteria.get(key, {}) if isinstance(criteria, dict) else {}
        if not isinstance(item, dict):
            continue
        definition = rubric.get(key, {}) if isinstance(rubric, dict) else {}
        score = item.get("score")
        evidence_sources = item.get("evidence_sources", [])
        marketability_calc = ""
        if key == "marketability":
            marketability_calc = "\n#### Marketability A/B/C Calculation\n\n" + marketability_calculation_table(item.get("calculation", {})) + "\n"
        sections.append(
            f"""### {label}

| Field | Value |
|---|---|
| Score | {md_cell(item.get("score", "-"))} |
| Rubric Definition | {md_cell((definition.get("score_definitions") or {}).get(str(score), "-"))} |
| Judgment Reason | {md_cell(item.get("main_line_summary") or item.get("reason", "-"))} |
| Investigation Note | {md_cell(item.get("investigation_note", "-"))} |

#### Conflicting Or Missing Evidence

{bullet_list(item.get("uncertain_points", []))}
{marketability_calc}

#### Evidence Sources

{source_table(evidence_sources)}
"""
        )
    return "\n\n".join(sections)


def competitive_summary(record: dict[str, Any]) -> str:
    competitive = record.get("competitive_analysis", {})
    summary = competitive.get("similarity_summary", {}) if isinstance(competitive, dict) else {}
    similar = competitive.get("similar_pipelines", []) if isinstance(competitive, dict) else []
    competitors = competitive.get("competitor_table", []) if isinstance(competitive, dict) else []
    rows = [
        "| Metric | Value |",
        "|---|---:|",
        f"| Similar pipelines | {summary.get('similar_pipeline_count', len(similar))} |",
        f"| High similarity | {summary.get('high_similarity_count', 0)} |",
        f"| Medium similarity | {summary.get('medium_similarity_count', 0)} |",
        f"| Low similarity | {summary.get('low_similarity_count', 0)} |",
    ]
    competitor_rows = [
        "| Competitor | Company | Modality | Target or MoA | Stage | Relevance | Source |",
        "|---|---|---|---|---|---|---|",
    ]
    for item in competitors:
        if not isinstance(item, dict):
            continue
        competitor_rows.append(
            "| "
            + " | ".join(
                [
                    md_cell(item.get("competitor_name", "-")),
                    md_cell(item.get("company", "-")),
                    md_cell(item.get("modality", "-")),
                    md_cell(item.get("target_or_moa", "-")),
                    md_cell(item.get("development_stage", "-")),
                    md_cell(item.get("relevance_to_asset", "-")),
                    md_cell(item.get("source", "-")),
                ]
            )
            + " |"
        )
    if len(competitor_rows) == 2:
        competitor_rows.append("| None | - | - | - | - | - | - |")

    details = ["| Company | Asset | Similarity | Matched dimensions | Shared data points |", "|---|---|---:|---|---|"]
    for item in similar:
        if not isinstance(item, dict):
            continue
        details.append(
            "| "
            + " | ".join(
                [
                    md_cell(item.get("company", "-")),
                    md_cell(item.get("asset_name", "-")),
                    md_cell(item.get("similarity_score", "-")),
                    md_cell(", ".join(item.get("matched_dimensions", []) or [])),
                    md_cell("<br>".join(item.get("shared_data_points", []) or []) or "-"),
                ]
            )
            + " |"
        )
    if len(details) == 2:
        details.append("| None | None | - | - | - |")
    analysis_summary = competitive.get("analysis_summary") or summary.get("summary", "")
    return "\n".join(rows) + "\n\n" + str(analysis_summary) + "\n\n" + "\n".join(competitor_rows) + "\n\n" + "\n".join(details)


def competitor_evidence(record: dict[str, Any]) -> str:
    competitive = record.get("competitive_analysis", {})
    sources = competitive.get("competitor_evidence_sources", []) if isinstance(competitive, dict) else []
    return source_table(sources)


def bullet_list(items: list[Any]) -> str:
    if not items:
        return "- None"
    return "\n".join(f"- {item}" for item in items)


def asset_note(record: dict[str, Any], generated_at: str) -> tuple[str, str]:
    summary = record.get("json_summary", {})
    table = record.get("structured_table", {})
    obsidian = record.get("obsidian", {})
    scoring = record.get("scoring", {})

    note_title = safe_name(obsidian.get("note_title") or get(record, "meta.output_filename_base"))
    company = summary.get("company") or table.get("company") or "Unknown Company"
    asset = summary.get("asset_name") or table.get("asset_name") or note_title
    theme = summary.get("theme") or "No Theme"
    cluster = summary.get("cluster") or "No Cluster"
    target = summary.get("target") or table.get("target") or "-"

    fm = frontmatter(
        {
            "generated_from": "json/pipeline-records.json",
            "generated_at": generated_at,
            "record_id": get(record, "meta.output_filename_base", note_title),
            "company": company,
            "country": summary.get("company_country", table.get("company_country", "")),
            "asset": asset,
            "target": target,
            "theme": theme,
            "cluster": cluster,
            "stage": table.get("development_stage", ""),
            "total_score": scoring.get("total_score"),
            "max_score": scoring.get("max_score"),
            "tags": obsidian.get("tags", []),
        }
    )

    content = f"""{fm}

# {asset}

> Generated from `json/pipeline-records.json`. Treat JSON as the single source of truth.

## Summary

| Field | Value |
|---|---|
| Company | {wikilink(company)} |
| Country | {summary.get("company_country", table.get("company_country", "-"))} |
| Asset | {asset} |
| Target | {target} |
| Theme | {wikilink("Theme - " + theme, theme)} |
| Cluster | {wikilink("Cluster - " + cluster, cluster)} |
| Stage | {table.get("development_stage", "-")} |
| Indication | {table.get("indication", "-")} |
| Modality | {table.get("modality_platform", "-")} |
| Hard Filter | {get(record, "hard_filter.overall_result", "-")} |
| Total Score | {scoring.get("total_score", "-")} / {scoring.get("max_score", "-")} |

## One-Line Insight

{get(record, "final_insight.one_line_summary", "-")}

## Scoring

{score_table(record)}

## Detailed Scoring Rationale

{scoring_rationale_sections(record)}

## Competitive Similarity

{competitive_summary(record)}

### Competitor Evidence Sources

{competitor_evidence(record)}

## Key Strengths

{bullet_list(get(record, "final_insight.key_strengths", []))}

## Key Risks

{bullet_list(get(record, "final_insight.key_risks", []))}

## Validation

### Cross-Checked Facts

{bullet_list(get(record, "validation.cross_checked_facts", []))}

### Uncertain Points

{bullet_list(get(record, "validation.uncertain_points", []))}

## Source Links

- Company: {wikilink(company)}
- Theme: {wikilink("Theme - " + theme, theme)}
- Cluster: {wikilink("Cluster - " + cluster, cluster)}
- Dashboard record id: `{get(record, "meta.output_filename_base", note_title)}`

## Raw JSON

```json
{json.dumps(record, ensure_ascii=False, indent=2)}
```
"""
    return note_title, content


def load_records() -> list[dict[str, Any]]:
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("records"), list):
        return data["records"]
    if isinstance(data, dict):
        return [data]
    raise ValueError("Unsupported pipeline records JSON format.")


def generate() -> None:
    records = load_records()
    generated_at = datetime.now().isoformat(timespec="seconds")

    OUTPUT_DIR.mkdir(exist_ok=True)
    for dirname in MANAGED_DIRS:
        target = OUTPUT_DIR / dirname
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True, exist_ok=True)

    asset_links: list[tuple[dict[str, Any], str]] = []
    by_company: dict[str, list[str]] = {}
    by_theme: dict[str, list[str]] = {}
    by_cluster: dict[str, list[str]] = {}

    for record in records:
        note_title, content = asset_note(record, generated_at)
        write_note(OUTPUT_DIR / "Assets" / f"{note_title}.md", content)
        asset_links.append((record, note_title))

        summary = record.get("json_summary", {})
        company = summary.get("company") or get(record, "structured_table.company", "Unknown Company")
        theme = summary.get("theme") or "No Theme"
        cluster = summary.get("cluster") or "No Cluster"
        by_company.setdefault(company, []).append(note_title)
        by_theme.setdefault(theme, []).append(note_title)
        by_cluster.setdefault(cluster, []).append(note_title)

    write_index(asset_links, generated_at)
    write_group_notes("Companies", by_company, "Company", generated_at)
    write_group_notes("Themes", by_theme, "Theme", generated_at)
    write_group_notes("Clusters", by_cluster, "Cluster", generated_at)
    write_readme(generated_at)


def write_index(asset_links: list[tuple[dict[str, Any], str]], generated_at: str) -> None:
    rows = ["| Asset | Company | Country | Theme | Cluster | Stage | Score |", "|---|---|---|---|---|---|---:|"]
    for record, note_title in asset_links:
        summary = record.get("json_summary", {})
        table = record.get("structured_table", {})
        scoring = record.get("scoring", {})
        rows.append(
            "| "
            + " | ".join(
                [
                    wikilink(note_title, summary.get("asset_name", note_title)),
                    wikilink(summary.get("company", "-")),
                    str(summary.get("company_country", "-")),
                    wikilink("Theme - " + str(summary.get("theme") or "No Theme"), str(summary.get("theme") or "No Theme")),
                    wikilink("Cluster - " + str(summary.get("cluster") or "No Cluster"), str(summary.get("cluster") or "No Cluster")),
                    str(table.get("development_stage", "-")),
                    f"{scoring.get('total_score', '-')} / {scoring.get('max_score', '-')}",
                ]
            )
            + " |"
        )

    content = f"""# Pipeline Index

> Generated from `json/pipeline-records.json` at `{generated_at}`.

## Assets

{chr(10).join(rows)}

## Navigation

- [[Companies]]
- [[Themes]]
- [[Clusters]]
"""
    write_note(OUTPUT_DIR / "Pipeline_Index.md", content)


def write_group_notes(dirname: str, groups: dict[str, list[str]], label: str, generated_at: str) -> None:
    index_rows = [f"# {dirname}", "", f"> Generated at `{generated_at}`.", ""]
    for name, notes in sorted(groups.items()):
        note_name = f"{label} - {name}" if label != "Company" else name
        index_rows.append(f"- {wikilink(note_name, name)} ({len(notes)})")
        content = [
            f"# {name}",
            "",
            f"> Generated from `json/pipeline-records.json` at `{generated_at}`.",
            "",
            f"## Linked Assets",
            "",
            *(f"- {wikilink(note)}" for note in sorted(notes)),
        ]
        write_note(OUTPUT_DIR / dirname / f"{safe_name(note_name)}.md", "\n".join(content))
    write_note(OUTPUT_DIR / f"{dirname}.md", "\n".join(index_rows))


def write_readme(generated_at: str) -> None:
    content = f"""# Obsidian Export

This folder is generated from `json/pipeline-records.json`.

Generated at: `{generated_at}`

## Rule

`json/pipeline-records.json` is the single source of truth. Edit JSON first, then regenerate Markdown.

## Entry Points

- [[Pipeline_Index]]
- [[Companies]]
- [[Themes]]
- [[Clusters]]

## Folder Structure

- `Assets/`: One note per pipeline asset
- `Companies/`: Company-level backlinks
- `Themes/`: Theme-level backlinks
- `Clusters/`: Cluster-level backlinks
"""
    write_note(OUTPUT_DIR / "README.md", content)


if __name__ == "__main__":
    generate()
