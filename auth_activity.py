"""Local account activity metrics. No network sync and no inferred legacy time."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import math

KST = ZoneInfo("Asia/Seoul")
EVENT_LIMIT = 2000


def timestamp(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    except (ValueError, TypeError, OverflowError):
        return None


def seconds(value, maximum=None):
    try:
        number = float(value) if not isinstance(value, bool) else 0
        number = max(0, int(number)) if math.isfinite(number) else 0
        return min(number, maximum) if maximum is not None else number
    except (ValueError, TypeError, OverflowError):
        return 0


def record_activity(user, payload, now, actor_ip, peer_ip):
    path = str(payload.get("path") or "/")[:500]
    requested = seconds(payload.get("active_seconds"), 120)
    last = timestamp(user.get("activity_clock_at"))
    accepted = min(requested, max(0, int((now - last).total_seconds()))) if last else 0
    # One per-account clock caps concurrent tabs/devices to elapsed wall time.
    user["activity_clock_at"] = now.isoformat()
    user["last_seen_at"] = now.isoformat()
    user.setdefault("activity_measurement_started_at", now.isoformat())
    event = {"event": "active_heartbeat" if requested else "page_view", "at": now.isoformat(),
             "path": path, "actor_ip": actor_ip, "peer_ip": peer_ip, "active_seconds": accepted}
    events = user.get("activity_log")
    user["activity_log"] = [*(events if isinstance(events, list) else []), event][-EVENT_LIMIT:]
    daily = user.get("activity_daily")
    daily = daily if isinstance(daily, dict) else {}
    today = now.astimezone(KST).date()
    cutoff = (today - timedelta(days=99)).isoformat()
    daily = {key: value for key, value in daily.items() if cutoff <= key <= today.isoformat() and isinstance(value, dict)}
    bucket = daily.setdefault(today.isoformat(), {"active_seconds": 0, "events": 0})
    bucket["active_seconds"] = seconds(bucket.get("active_seconds")) + accepted
    bucket["events"] = seconds(bucket.get("events")) + 1
    user["activity_daily"] = daily
    user["active_seconds_total"] = seconds(user.get("active_seconds_total")) + accepted
    return event


def user_metrics(user, now):
    buckets = user.get("activity_daily")
    daily = {key: dict(value) for key, value in (buckets if isinstance(buckets, dict) else {}).items() if isinstance(value, dict)}
    # Historical events establish visits; they do not establish duration.
    for event in user.get("activity_log") or []:
        if not isinstance(event, dict):
            continue
        at = timestamp(event.get("at"))
        if at and event.get("event") in {"signup", "signin", "page_view", "active_heartbeat"}:
            daily.setdefault(at.astimezone(KST).date().isoformat(), {"active_seconds": 0, "events": 1})
    today = now.astimezone(KST).date()
    cutoff = (today - timedelta(days=29)).isoformat()
    window = [value for key, value in daily.items() if cutoff <= key <= today.isoformat()]
    return {"active_seconds_30d": sum(seconds(value.get("active_seconds")) for value in window),
            "active_seconds_total": seconds(user.get("active_seconds_total")),
            "active_days_30d": sum(seconds(value.get("events")) > 0 for value in window),
            "activity_measurement_started_at": user.get("activity_measurement_started_at"),
            "activity_log_limit": EVENT_LIMIT}


def summary(users, now):
    today = now.astimezone(KST).date()
    days = [(today - timedelta(days=offset)).isoformat() for offset in range(99, -1, -1)]
    activity = {day: 0 for day in days}
    signups = {day: 0 for day in days}
    starts = []
    for user in users:
        created = timestamp(user.get("created_at"))
        day = created.astimezone(KST).date().isoformat() if created else ""
        if day in signups:
            signups[day] += 1
        buckets = user.get("activity_daily")
        for day, bucket in (buckets if isinstance(buckets, dict) else {}).items():
            if day in activity and isinstance(bucket, dict):
                activity[day] += seconds(bucket.get("active_seconds"))
        if user.get("activity_measurement_started_at"):
            starts.append(user["activity_measurement_started_at"])
    return {"activity_days": [{"date": day, "active_seconds": activity[day]} for day in days],
            "signup_days": [{"date": day, "count": signups[day]} for day in days],
            "activity_measurement_started_at": min(starts) if starts else None,
            "timezone": "Asia/Seoul"}


def last_seen(user):
    values = [timestamp(user.get(key)) for key in ("last_seen_at", "last_login_at")]
    latest = max((value for value in values if value), default=None)
    return latest.astimezone(timezone.utc).isoformat() if latest else ""
