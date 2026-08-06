"""Canonical minimal persisted record shape for dashboard, charts, and operations."""

from __future__ import annotations

import copy
import hashlib
import json
import re
from typing import Any
from urllib.parse import urlsplit, urlunsplit


STORAGE_PROFILE = "dashboard_hybrid_v1"
LEGACY_STORAGE_PROFILES = {"dashboard_minimal_v1", STORAGE_PROFILE}
FULL_CRITERION_IDS = (
    "target_relevance",
    "competitive_landscape",
    "moa_validity",
    "platform_attractiveness",
    "expansion_potential",
    "data_maturity",
    "marketability",
)
TRIAGE_CRITERION_IDS = ("target_relevance", "moa_validity", "data_maturity")
TRIAGE_STATUSES = {"SELECT", "REJECT", "UNVERIFIED"}

FULL_SCOUT_HARD_BLOCKER_RE = re.compile(
    r"\boutside\s+(?:the\s+)?(?:primary\s+)?(?:therapeutic\s+area|indication|disease)\s+scope\b|"
    r"\bout\s+of\s+(?:therapeutic|indication|disease)\s+scope\b|"
    r"\bno\s+public\s+target\b|"
    r"\bno\b[^|.;\n]{0,48}\btarget\s*/\s*moa\b|"
    r"\basset\s+identity\s+(?:is\s+)?(?:not\s+verified|unverified)\b|"
    r"\b(?:discontinued|terminated|withdrawn|suspended|dormant|inactive|clearly\s+failed)\b|"
    r"(?:관심\s*)?(?:질환|적응증|치료\s*영역)\s*범위\s*밖|"
    r"자산\s*식별\s*불가|"
    r"(?:개발|프로그램|임상)\s*(?:이\s*)?중단",
    flags=re.IGNORECASE,
)

FULL_SCOUT_UNCERTAINTY_RE = re.compile(
    r"\b(?:stage|rights?|licen[cs]e|ownership|asset\s+identity|source|registry|sponsor)\b"
    r"[^|.;\n]{0,64}\b(?:unclear|uncertain|unknown|unverified|unconfirmed|ambiguous|"
    r"not\s+(?:public(?:ly\s+available)?|verified|confirmed|clear|established)|"
    r"(?:pending|requires?|needs?)\s+(?:independent\s+)?(?:verification|confirmation))\b|"
    r"\b(?:unclear|uncertain|unknown|unverified|unconfirmed|ambiguous|"
    r"not\s+(?:public(?:ly\s+available)?|verified|confirmed|clear|established)|"
    r"(?:could\s+not|cannot|unable\s+to)\s+(?:verify|confirm|establish|identify)|"
    r"(?:pending|requires?|needs?)\s+(?:independent\s+)?(?:verification|confirmation))\b"
    r"[^|.;\n]{0,64}\b(?:stage|rights?|licen[cs]e|ownership|asset\s+identity|source|registry|sponsor)\b|"
    r"(?:개발\s*단계|단계|권리|라이선스|소유권|자산\s*식별|출처|소스|레지스트리|스폰서)"
    r"[^|.;\n]{0,48}(?:불확실|불명확|미확인|확인\s*(?:불가|필요)|검증\s*(?:불가|필요)|자료\s*(?:부족|없음))|"
    r"(?:불확실|불명확|미확인|확인\s*(?:불가|필요)|검증\s*(?:불가|필요)|자료\s*(?:부족|없음))"
    r"[^|.;\n]{0,48}(?:개발\s*단계|단계|권리|라이선스|소유권|자산\s*식별|출처|소스|레지스트리|스폰서)",
    flags=re.IGNORECASE,
)


def _object(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _text(*values: Any, default: str = "") -> str:
    for value in values:
        if value is None or isinstance(value, (dict, list, tuple, set)):
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def _is_triage(record: dict[str, Any]) -> bool:
    meta = _object(record.get("meta"))
    hard_filter = _object(record.get("hard_filter"))
    triage = _object(record.get("triage"))
    review_type = _text(meta.get("review_type")).lower()
    status = _text(hard_filter.get("status"), triage.get("status")).upper()
    return "triage" in review_type or status in TRIAGE_STATUSES or bool(triage)


def _minimal_source(source: Any, *, include_display: bool = False) -> dict[str, Any] | None:
    if isinstance(source, str):
        value = source.strip()
        if not value:
            return None
        source = {
            "source_title": value,
            "source_url": value if value.lower().startswith(("http://", "https://")) else "",
        }
    if not isinstance(source, dict):
        return None
    title = _text(source.get("source_title"), source.get("title"), source.get("name"))
    url = _text(source.get("source_url"), source.get("url"), source.get("href"))
    if not title and not url:
        return None
    result: dict[str, Any] = {
        "source_id": _text(source.get("source_id"), source.get("id")),
        "source_title": title or url,
        "source_url": url,
    }
    if not result["source_id"]:
        # Preserve the exporter's legacy source identity semantics: sources are
        # distinct when their URL/title text is distinct.  The deterministic ID
        # lets criteria reference the canonical registry without duplicating the
        # complete source object under every score.
        identity = (url or title).strip()
        result["source_id"] = f"SRC_{hashlib.sha1(identity.encode('utf-8')).hexdigest()[:12]}"
    if include_display:
        for key, aliases in {
            "source_type": ("source_type", "type"),
            "reliability": ("reliability",),
            "evidence_summary": ("evidence_summary", "claim_supported"),
        }.items():
            value = _text(*(source.get(alias) for alias in aliases))
            if value:
                result[key] = value
        if isinstance(source.get("verified"), bool):
            result["verified"] = source["verified"]
    return result


def _first_dashboard_source(record: dict[str, Any]) -> list[dict[str, Any]]:
    table = _object(record.get("structured_table"))
    validation = _object(record.get("validation"))
    candidates = [*_list(table.get("sources")), *_list(validation.get("source_registry"))]
    for candidate in candidates:
        source = _minimal_source(candidate)
        if source:
            return [{"source_title": source["source_title"], "source_url": source["source_url"]}]
    return []


def _source_key(source: dict[str, Any]) -> str:
    return _text(source.get("source_url"), source.get("source_title"), source.get("source_id"))


def _record_source_registry(record: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    validation = _object(record.get("validation"))
    criteria = _object(_object(record.get("scoring")).get("criteria"))
    competitive = _object(record.get("competitive_analysis"))
    table_sources = _list(_object(record.get("structured_table")).get("sources"))
    if _text(_object(record.get("meta")).get("storage_profile")).lower() == STORAGE_PROFILE.lower():
        explicit_by_key: dict[str, Any] = {}
        for explicit in _list(validation.get("source_registry")):
            normalized = _minimal_source(explicit)
            if normalized:
                explicit_by_key[_source_key(normalized)] = explicit
        table_sources = [
            explicit_by_key.get(_source_key(_minimal_source(source) or {}), source)
            if isinstance(source, dict) and not _text(source.get("source_id"), source.get("id"))
            else source
            for source in table_sources
        ]
    # Keep the same precedence as scripts/export_pipeline_wiki.py::source_items.
    # That makes a legacy record and its hybrid projection generate identical
    # source nodes, titles, and associations.
    candidates: list[Any] = [*table_sources]
    candidates.extend(_list(validation.get("source_registry")))
    for competitor in _list(competitive.get("competitor_table")):
        item = _object(competitor)
        if _text(item.get("source_url")):
            candidates.append(
                {
                    "source_id": _list(item.get("source_ids"))[0] if _list(item.get("source_ids")) else "",
                    "source_title": f"{_text(item.get('competitor_asset'), item.get('asset'), item.get('competitor_name'), item.get('competitor'), default='Competitor')} source",
                    "source_url": item.get("source_url"),
                    "source_type": "other",
                }
            )
    for criterion in criteria.values():
        item = _object(criterion)
        candidates.extend(_list(item.get("verified_evidence_sources")))
        candidates.extend(_list(item.get("evidence_sources")))

    registry: list[dict[str, Any]] = []
    by_id: dict[str, dict[str, Any]] = {}
    by_key: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        source = _minimal_source(candidate, include_display=True)
        if not source:
            continue
        key = _source_key(source)
        existing = by_key.get(key)
        if existing:
            for field, value in source.items():
                if value not in (None, "", []) and existing.get(field) in (None, "", []):
                    existing[field] = value
            by_id[source["source_id"]] = existing
            continue
        if source["source_id"] in by_id:
            # A malformed legacy record can reuse an ID for two distinct sources.
            # Keep both sources and assign the later one a deterministic safe ID;
            # new Compact v2 uploads are rejected earlier for the same collision.
            identity = _source_key(source)
            base_id = f"SRC_{hashlib.sha1(identity.encode('utf-8')).hexdigest()[:12]}"
            source["source_id"] = base_id
            suffix = 2
            while source["source_id"] in by_id:
                source["source_id"] = f"{base_id}_{suffix}"
                suffix += 1
        registry.append(source)
        by_key[key] = source
        by_id[source["source_id"]] = source

    for candidate in _list(validation.get("source_registry")):
        if not isinstance(candidate, dict):
            continue
        source_id = _text(candidate.get("source_id"), candidate.get("id"))
        source = _minimal_source(candidate, include_display=True)
        if source_id and source:
            by_id[source_id] = by_key.get(_source_key(source), source)
    return registry, by_id


def _minimal_meta(record: dict[str, Any], *, triage: bool) -> dict[str, Any]:
    meta = copy.deepcopy(_object(record.get("meta")))
    # These are prompt boilerplate or regenerated presentation metadata. Operational
    # state (attachments, notes, reviews, focus management, audit/reupload history)
    # is intentionally preserved even though it is not a dashboard research field.
    for key in ("analyst_role", "output_format", "language", "rubric_author", "ingestion_format"):
        meta.pop(key, None)
    meta["review_type"] = "fast_triage" if triage else "full_scout"
    meta["storage_profile"] = STORAGE_PROFILE
    return meta


def _minimal_source_report(record: dict[str, Any]) -> dict[str, Any]:
    source = _object(record.get("source_report"))
    result = {
        "raw_markdown": str(source.get("raw_markdown") or ""),
        "parser_status": _text(source.get("parser_status"), default="not_parsed"),
    }
    for key in ("revision_history", "rubric_recalculation"):
        if key in source:
            result[key] = copy.deepcopy(source[key])
    return result


def _minimal_input(record: dict[str, Any], table: dict[str, Any]) -> dict[str, str]:
    """Keep the two aliases used to join Fast Triage and Full Scout records."""
    input_data = _object(record.get("input"))
    return {
        "company_input": _text(input_data.get("company_input"), table.get("company"), default="Unknown"),
        "asset_input": _text(input_data.get("asset_input"), table.get("asset_name"), default="Unknown"),
    }


def _minimal_structured_table(record: dict[str, Any]) -> dict[str, Any]:
    table = _object(record.get("structured_table"))
    summary = _object(record.get("json_summary"))
    return {
        "company": _text(table.get("company"), summary.get("company"), default="Unknown"),
        "asset_name": _text(table.get("asset_name"), summary.get("asset_name"), default="Unknown"),
        # Match the home-table precedence so migration never changes a visible value.
        "target": _text(summary.get("target"), table.get("target"), default="Unknown"),
        "moa": _text(table.get("moa"), default="Unknown"),
        "modality_platform": _text(
            table.get("modality_platform"), summary.get("modality_platform"), summary.get("modality"), default="Unknown"
        ),
        "main_indication": _text(
            table.get("main_indication"), table.get("primary_indication"), summary.get("main_indication")
        ),
        "indication": _text(table.get("indication"), summary.get("indication"), default="Unknown"),
        "development_stage": _text(table.get("development_stage"), default="Unknown"),
        "company_country": _text(table.get("company_country"), summary.get("company_country"), default="Unknown"),
        "sources": _first_dashboard_source(record),
    }


def _minimal_marketability_calculation(value: Any) -> dict[str, Any] | None:
    calculation = _object(value)
    if not calculation:
        return None
    result: dict[str, Any] = {
        "commercial_rationale_status": _text(calculation.get("commercial_rationale_status")),
        "commercial_rationale_failure_reason": _text(calculation.get("commercial_rationale_failure_reason")),
    }
    step_fields = {
        "A_targetable_addressable_patient": ("targetable_addressable_patient", "formula"),
        "B_unrisked_peak_sales": ("unrisked_peak_sales", "sales_unit", "formula"),
        "C_obtainable_peak_sales": ("obtainable_peak_sales", "sales_unit", "formula"),
        "D_global_obtainable_peak_sales": (
            "source_geography",
            "global_multiplier",
            "global_obtainable_peak_sales",
            "sales_unit",
            "formula",
        ),
    }
    for step_name, fields in step_fields.items():
        source_step = _object(calculation.get(step_name))
        if step_name == "D_global_obtainable_peak_sales" and not source_step:
            continue
        step: dict[str, Any] = {}
        for field in fields:
            value = source_step.get(field)
            if field in {"formula", "sales_unit", "source_geography"}:
                step[field] = _text(value)
            else:
                step[field] = value if isinstance(value, (int, float)) and not isinstance(value, bool) else None
        result[step_name] = step
    return result


def _criterion_source_ids(criterion: dict[str, Any], registry_by_id: dict[str, dict[str, Any]]) -> list[str]:
    candidates: list[Any] = []
    if isinstance(criterion.get("verified_evidence_sources"), list):
        candidates.extend(criterion["verified_evidence_sources"])
    else:
        candidates.extend(_list(criterion.get("evidence_sources")))
    for source_id in _list(criterion.get("source_ids")):
        source = registry_by_id.get(str(source_id).strip())
        if source:
            candidates.append(source)

    result: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        source = _minimal_source(candidate, include_display=True)
        if not source:
            continue
        canonical = registry_by_id.get(source["source_id"], source)
        source_id = _text(canonical.get("source_id"), source.get("source_id"))
        if not source_id or source_id in seen:
            continue
        seen.add(source_id)
        result.append(source_id)
    return result


def _minimal_criterion(
    criterion: dict[str, Any],
    *,
    triage: bool,
    criterion_id: str,
    registry_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "score": criterion.get("score"),
        "evidence_type": _text(criterion.get("evidence_type"), default="triage_only" if triage else ""),
        "evidence_type_reason": _text(criterion.get("evidence_type_reason")),
        "evidence_basis": _text(criterion.get("evidence_basis")),
        "main_line_summary": _text(criterion.get("main_line_summary"), criterion.get("reason")),
        "why_not_higher": _text(criterion.get("why_not_higher")),
        "investigation_note": _text(criterion.get("investigation_note")),
        "uncertain_points": copy.deepcopy(_list(criterion.get("uncertain_points"))),
        "source_ids": _criterion_source_ids(criterion, registry_by_id),
    }
    if criterion_id == "marketability":
        calculation = _minimal_marketability_calculation(criterion.get("calculation"))
        if calculation:
            result["calculation"] = calculation
    return result


def _minimal_scoring(
    record: dict[str, Any],
    *,
    triage: bool,
    registry_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    scoring = _object(record.get("scoring"))
    criteria = _object(scoring.get("criteria"))
    criterion_ids = TRIAGE_CRITERION_IDS if triage else FULL_CRITERION_IDS
    minimal_criteria: dict[str, dict[str, Any]] = {}
    scores: list[int] = []
    for criterion_id in criterion_ids:
        criterion = _object(criteria.get(criterion_id))
        score = criterion.get("score")
        minimal_criteria[criterion_id] = _minimal_criterion(
            criterion,
            triage=triage,
            criterion_id=criterion_id,
            registry_by_id=registry_by_id,
        )
        if isinstance(score, int) and not isinstance(score, bool):
            scores.append(score)
    total = scoring.get("total_score")
    if "total_score" not in scoring:
        total = sum(scores) if len(scores) == len(criterion_ids) else None
    max_score = scoring.get("max_score")
    if "max_score" not in scoring:
        max_score = 9 if triage else 21
    return {
        "criteria": minimal_criteria,
        "total_score": total,
        "max_score": max_score,
    }


def _normalized_triage_status(*values: Any) -> str:
    status = _text(*values, default="UNVERIFIED").upper()
    return "UNVERIFIED" if status in {"N/A", "NA"} else status


def _verified_triage_source_count(record: dict[str, Any]) -> int:
    triage = _object(record.get("triage"))
    explicit_count = triage.get("verified_public_source_count")
    if isinstance(explicit_count, int) and not isinstance(explicit_count, bool) and explicit_count >= 0:
        return explicit_count

    meta = _object(record.get("meta"))
    criteria = _object(_object(record.get("scoring")).get("criteria"))
    current_contract = (
        _text(meta.get("schema_version")).lstrip("vV") == "3.2"
        or _text(meta.get("instruction_version")).lstrip("vV") == "3.2"
    )
    urls: set[str] = set()
    for criterion in criteria.values():
        item = _object(criterion)
        explicit_list = isinstance(item.get("verified_evidence_sources"), list)
        sources = item.get("verified_evidence_sources") if explicit_list else item.get("evidence_sources")
        for source in _list(sources):
            if isinstance(source, dict):
                if source.get("verified") is False:
                    continue
                if current_contract and not explicit_list and source.get("verified") is not True:
                    continue
                raw_url = _text(source.get("source_url"), source.get("url"))
            else:
                if current_contract and not explicit_list:
                    continue
                raw_url = _text(source)
            try:
                parsed = urlsplit(raw_url)
            except ValueError:
                continue
            hostname = (parsed.hostname or "").lower()
            if parsed.scheme.lower() not in {"http", "https"} or not hostname:
                continue
            if hostname in {"localhost", "127.0.0.1", "::1"}:
                continue
            normalized = urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/"), parsed.query, ""))
            urls.add(normalized)
    return len(urls)


def full_scout_has_hard_blocker(notes: str) -> bool:
    """Detect an affirmed blocker without treating explicit negation as a blocker."""
    for match in FULL_SCOUT_HARD_BLOCKER_RE.finditer(str(notes or "")):
        prefix = notes[max(0, match.start() - 28) : match.start()]
        suffix = notes[match.end() : match.end() + 20]
        if re.search(r"\b(?:not|without|never)\b[^|.;\n]{0,20}$|(?:아니|없)는?\s*$", prefix, re.IGNORECASE):
            continue
        if re.match(r"\s*(?:없(?:음|다)?|아님|아니|not\b|false\b)", suffix, re.IGNORECASE):
            continue
        return True
    return False


def full_scout_has_decision_uncertainty(notes: str) -> bool:
    return FULL_SCOUT_UNCERTAINTY_RE.search(str(notes or "")) is not None


def _full_filter_text(record: dict[str, Any]) -> str:
    hard_filter = _object(record.get("hard_filter"))
    values: list[Any] = [hard_filter.get("reason"), *_list(hard_filter.get("flags"))]
    table = _object(record.get("structured_table"))
    if table.get("development_stage"):
        values.insert(0, f"Development stage: {table['development_stage']}")
    values.extend(_list(hard_filter.get("fail_reasons")))
    criteria = _object(_object(record.get("scoring")).get("criteria"))
    for criterion in criteria.values():
        item = _object(criterion)
        values.extend(
            item.get(key)
            for key in ("main_line_summary", "investigation_note", "why_not_higher")
        )
        values.extend(_list(item.get("uncertain_points")))
    values.extend(_list(_object(record.get("validation")).get("uncertain_points")))
    insight = _object(record.get("final_insight"))
    values.extend(
        insight.get(key)
        for key in ("one_line_summary", "most_important_diligence_question")
    )
    return " | ".join(str(value) for value in values if value)


def _derived_full_hard_blocker(record: dict[str, Any]) -> bool:
    explicit = _object(record.get("hard_filter")).get("hard_blocker")
    return explicit if isinstance(explicit, bool) else full_scout_has_hard_blocker(_full_filter_text(record))


def _derived_full_decision_uncertainty(record: dict[str, Any]) -> bool:
    explicit = _object(record.get("hard_filter")).get("decision_uncertainty")
    return explicit if isinstance(explicit, bool) else full_scout_has_decision_uncertainty(_full_filter_text(record))


def _minimal_competitor_rows(value: Any, registry_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for candidate in _list(value):
        source = _object(candidate)
        if not source:
            continue
        row = {
            "competitor_asset": _text(
                source.get("competitor_asset"),
                source.get("asset"),
                source.get("competitor_name"),
                source.get("competitor"),
                default="Unknown Competitor",
            ),
            "company": _text(source.get("company"), default="Unknown Company"),
            "modality": _text(source.get("modality")),
            "target_or_moa": _text(
                source.get("target_or_moa"), source.get("target_moa"), source.get("target"), source.get("moa")
            ),
            "stage": _text(source.get("stage"), source.get("stage_status"), source.get("development_stage")),
            "similarity_level": _text(source.get("similarity_level"), source.get("similarity"), default="Unknown"),
            "why_it_matters": _text(source.get("why_it_matters"), source.get("relevance_to_asset")),
            "source_url": _text(source.get("source_url")),
        }
        if not row["source_url"]:
            for source_id in _list(source.get("source_ids")):
                linked = registry_by_id.get(str(source_id).strip())
                if linked and _text(linked.get("source_url")):
                    row["source_url"] = _text(linked.get("source_url"))
                    break
        rows.append(row)
    return rows


def _minimal_cross_checked_facts(
    value: Any,
    registry_by_id: dict[str, dict[str, Any]],
) -> list[Any]:
    facts: list[Any] = []
    for candidate in _list(value):
        if isinstance(candidate, str):
            fact = candidate.strip()
            if fact:
                facts.append(fact)
            continue
        source = _object(candidate)
        fact = _text(source.get("fact"))
        if not fact:
            continue
        references: list[str] = []
        seen: set[str] = set()
        for reference in [*_list(source.get("sources")), *_list(source.get("source_ids"))]:
            if isinstance(reference, dict):
                normalized = _minimal_source(reference)
                rendered = _text(
                    _object(normalized).get("source_url"),
                    _object(normalized).get("source_title"),
                    _object(normalized).get("source_id"),
                )
            else:
                raw_reference = _text(reference)
                linked = registry_by_id.get(raw_reference)
                rendered = _text(
                    _object(linked).get("source_url"),
                    _object(linked).get("source_title"),
                    raw_reference,
                )
            if rendered and rendered not in seen:
                seen.add(rendered)
                references.append(rendered)
        facts.append({"fact": fact, "sources": references})
    return facts


def _minimal_similar_pipelines(value: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for candidate in _list(value):
        if isinstance(candidate, str) and candidate.strip():
            rows.append(
                {
                    "company": "",
                    "asset_name": candidate.strip(),
                    "similarity_score": None,
                    "matched_dimensions": [],
                    "shared_data_points": [],
                }
            )
            continue
        source = _object(candidate)
        if not source:
            continue
        rows.append(
            {
                "company": _text(source.get("company")),
                "asset_name": _text(source.get("asset_name"), source.get("asset")),
                "similarity_score": source.get("similarity_score"),
                "matched_dimensions": copy.deepcopy(_list(source.get("matched_dimensions"))),
                "shared_data_points": copy.deepcopy(_list(source.get("shared_data_points"))),
            }
        )
    return rows


def minimize_record_for_dashboard_storage(record: dict[str, Any]) -> dict[str, Any]:
    """Return a deep-copied record containing dashboard fields plus operational state.

    Research narrative stays in source_report.raw_markdown. The structured JSON keeps
    only values consumed by tables/charts/filters and the state required for notes,
    attachments, review history, reuploads, and TAB3 operations.
    """

    if not isinstance(record, dict):
        raise TypeError("record must be an object")
    triage = _is_triage(record)
    summary = _object(record.get("json_summary"))
    hard_filter = _object(record.get("hard_filter"))
    profile = _object(record.get("company_profile"))
    competitive = _object(record.get("competitive_analysis"))
    similarity = _object(competitive.get("similarity_summary"))
    target_criterion = _object(_object(record.get("scoring")).get("criteria")).get("target_relevance")
    target_criterion = _object(target_criterion)
    validation = _object(record.get("validation"))
    insight = _object(record.get("final_insight"))
    table = _minimal_structured_table(record)
    source_registry, registry_by_id = _record_source_registry(record)
    filter_status = (
        _normalized_triage_status(hard_filter.get("status"))
        if triage
        else _text(hard_filter.get("status"), default="REVIEW").upper()
    )

    result: dict[str, Any] = {
        "meta": _minimal_meta(record, triage=triage),
        "source_report": _minimal_source_report(record),
        # These aliases are small but operationally necessary: dashboard identity
        # grouping uses them to join a Fast Triage row to its Full Scout record.
        "input": _minimal_input(record, table),
        "json_summary": {
            "theme": _text(summary.get("theme"), default="Unknown"),
            "cluster": _text(summary.get("cluster"), default="Unknown"),
            "target_description": _text(
                summary.get("target_description"),
                target_criterion.get("main_line_summary"),
                target_criterion.get("investigation_note"),
                insight.get("one_line_summary"),
                summary.get("one_line_summary"),
            ),
        },
        "structured_table": table,
        "hard_filter": {
            "status": filter_status,
            "reason": _text(hard_filter.get("reason")),
            "flags": copy.deepcopy(_list(hard_filter.get("flags"))),
            "hard_blocker": False if triage else _derived_full_hard_blocker(record),
            "decision_uncertainty": False if triage else _derived_full_decision_uncertainty(record),
        },
        "scoring": _minimal_scoring(record, triage=triage, registry_by_id=registry_by_id),
        "validation": {
            "uncertain_points": copy.deepcopy(_list(validation.get("uncertain_points"))),
            "cross_checked_facts": _minimal_cross_checked_facts(
                validation.get("cross_checked_facts"),
                registry_by_id,
            ),
            "source_registry": source_registry,
        },
        "final_insight": {
            "one_line_summary": _text(insight.get("one_line_summary"), summary.get("one_line_summary")),
            "recommendation": _text(insight.get("recommendation")),
            "most_important_diligence_question": _text(insight.get("most_important_diligence_question")),
        },
    }

    if triage:
        triage_data = _object(record.get("triage"))
        result["triage"] = {
            "status": _normalized_triage_status(triage_data.get("status"), hard_filter.get("status")),
            "identity_verified": triage_data.get("identity_verified") is True,
            "active_asset": triage_data.get("active_asset") if isinstance(triage_data.get("active_asset"), bool) else None,
            "verified_public_source_count": _verified_triage_source_count(record),
            "why": _text(triage_data.get("why"), hard_filter.get("reason")),
            "missing_evidence_needed_for_full_scout": copy.deepcopy(
                _list(triage_data.get("missing_evidence_needed_for_full_scout"))
            ),
        }
    else:
        result["company_profile"] = {
            "headquarters": _text(profile.get("headquarters")),
            "company_stage": _text(profile.get("company_stage")),
            "platform_summary": _text(profile.get("platform_summary")),
        }
        result["competitive_analysis"] = {
            "competitive_density": _text(competitive.get("competitive_density"), default="Unclear"),
            "similarity_summary": {
                "similar_pipeline_count": similarity.get("similar_pipeline_count", 0),
                "high_similarity_count": similarity.get("high_similarity_count", 0),
                "medium_similarity_count": similarity.get("medium_similarity_count", 0),
                "low_similarity_count": similarity.get("low_similarity_count", 0),
            },
            "competitor_table": _minimal_competitor_rows(
                competitive.get("competitor_table"), registry_by_id
            ),
            "similar_pipelines": _minimal_similar_pipelines(competitive.get("similar_pipelines")),
        }

    # A pending AI draft is application state rather than duplicated research JSON.
    if isinstance(record.get("ai_revision_draft"), dict):
        result["ai_revision_draft"] = copy.deepcopy(record["ai_revision_draft"])
    return result


def serialized_size(value: Any) -> int:
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
