"""Optional research projection; never changes scores or the original report."""
from __future__ import annotations

import re
from typing import Any

FIELDS = ("com_expiry_year", "expected_launch_year")


def normalize_ip_launch(record: dict[str, Any]) -> None:
    if "ip_launch_outlook" not in record:
        return  # Absence is meaningful for historical reports.
    if record.get("triage") is not None or (record.get("meta") or {}).get("review_type") == "fast_triage":
        record.pop("ip_launch_outlook", None)
        return
    raw = record["ip_launch_outlook"]
    normalized = {}
    issues = []
    if not isinstance(raw, dict):
        issues.append(f"ip_launch_outlook: invalid optional object {str(raw)[:120]}")
        raw = {}
    for key in FIELDS:
        if key not in raw:
            continue
        value = raw[key]
        if value is None or (isinstance(value, str) and value.strip().lower() in {"", "unknown", "n/a", "null", "확인 불가", "미확인"}):
            normalized[key] = None
        elif not isinstance(value, bool) and re.fullmatch(r"(?:19|20|21)\d{2}", str(value).strip()):
            normalized[key] = int(str(value).strip())
        else:
            # Do not turn ranges, dates, booleans or arbitrary prose into a year.
            issues.append(f"ip_launch_outlook.{key}: 원문 확인 필요 — {str(value)[:160]}")
    for key in raw.keys() - set(FIELDS):
        issues.append(f"ip_launch_outlook.{key}: 지원하지 않는 선택 항목 — {str(raw[key])[:160]}")
    record["ip_launch_outlook"] = normalized
    if issues:
        validation = record.setdefault("validation", {})
        if isinstance(validation, dict):
            existing = validation.get("uncertain_points")
            if not isinstance(existing, list):
                existing = []
            validation["uncertain_points"] = list(dict.fromkeys([*existing, *issues]))
