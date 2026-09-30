"""
Flood outlook for the next 6, 24 and 48 hours.

risk = rain factor x area history
  rain factor : forecast rainfall from Open-Meteo (free, no API key)
  area history: known flood-proneness + how often the area flooded in the past
                year (from reports stored in this app)

This is a transparent risk formula, not a trained ML model.
"""
import json
import math
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import config
from scoring import nearest_locality, now_iso

HORIZONS = (6, 24, 48)
HOURS = 48

_cache = {"at": 0.0, "data": None, "failed_at": 0.0}
_state = {"simulate": False}


def set_simulation(enabled: bool) -> None:
    _state["simulate"] = bool(enabled)


def is_simulating() -> bool:
    return _state["simulate"]


def _this_hour() -> datetime:
    """Current hour in UTC, without timezone info (matches Open-Meteo's GMT times)."""
    return datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0, tzinfo=None)


# ---------------------------------------------------------------------------
# Weather: live or simulated, as 48 hourly values per locality
# ---------------------------------------------------------------------------
def _simulated_hourly() -> dict:
    """A heavy-rain storm for demos: a big burst tonight, a second one tomorrow."""
    start = _this_hour()
    out = {}
    for loc in config.LOCALITIES:
        wobble = sum(ord(c) * (i + 1) for i, c in enumerate(loc["name"])) % 70
        peak = 9 + wobble / 6  # 9 to 20.5 mm in the heaviest hour
        hours = []
        for h in range(HOURS):
            rain = peak * math.exp(-(((h - 8) / 3.5) ** 2)) + 0.5 * peak * math.exp(-(((h - 31) / 4.5) ** 2))
            if 3 < h < 40:
                rain += 0.4
            rain = round(rain, 1)
            prob = int(min(95, 25 + rain * 9)) if rain >= 0.2 else 10
            hours.append({"time": (start + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M"), "rain": rain, "prob": prob})
        out[loc["name"]] = hours
    return out


def parse_open_meteo(payload, start=None) -> dict:
    """Open-Meteo hourly response -> {locality: [{time, rain, prob} x 48]}."""
    if isinstance(payload, dict):
        payload = [payload]
    start = start or _this_hour()
    out = {}
    for loc, item in zip(config.LOCALITIES, payload):
        hourly = item["hourly"]
        probs = hourly.get("precipitation_probability") or [None] * len(hourly["time"])
        hours = []
        for t, p, pr in zip(hourly["time"], hourly["precipitation"], probs):
            dt = datetime.fromisoformat(t)
            if start <= dt < start + timedelta(hours=HOURS):
                hours.append({"time": t, "rain": round(p or 0.0, 1), "prob": int(pr or 0)})
        out[loc["name"]] = hours
    return out


def _live_hourly():
    """Returns hourly rain per locality, or None if the weather service can't be reached."""
    if _cache["data"] is not None and time.time() - _cache["at"] < config.FORECAST_CACHE_SECONDS:
        return _cache["data"]
    if time.time() - _cache["failed_at"] < 60:
        return _cache["data"]  # recently failed; don't make every request wait
    query = urllib.parse.urlencode(
        {
            "latitude": ",".join(str(l["lat"]) for l in config.LOCALITIES),
            "longitude": ",".join(str(l["lng"]) for l in config.LOCALITIES),
            "hourly": "precipitation,precipitation_probability",
            "forecast_days": 3,
            "timezone": "GMT",
        }
    )
    try:
        with urllib.request.urlopen(f"https://api.open-meteo.com/v1/forecast?{query}", timeout=8) as resp:
            data = parse_open_meteo(json.load(resp))
        _cache.update(at=time.time(), data=data)
        return data
    except Exception as exc:
        print(f"[forecast] weather fetch failed: {exc}")
        _cache["failed_at"] = time.time()
        return _cache["data"]


# ---------------------------------------------------------------------------
# History: flood days per locality, total and per month (past 12 months)
# ---------------------------------------------------------------------------
def _month_keys() -> list:
    now = datetime.now(timezone.utc)
    keys = []
    y, m = now.year, now.month
    for _ in range(12):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def flood_history(conn):
    """Returns (month_keys, {locality: {"total": n, "by_month": [12 counts]}})."""
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=365)).isoformat(timespec="seconds")
    until = (now - timedelta(hours=config.REPORT_WINDOW_HOURS)).isoformat(timespec="seconds")  # past only
    rows = conn.execute(
        """SELECT lat, lng, created_at FROM reports
           WHERE status = 'active' AND depth >= 2 AND created_at >= ? AND created_at < ?""",
        (since, until),
    ).fetchall()
    days = defaultdict(set)
    for r in rows:
        days[nearest_locality(r["lat"], r["lng"])].add(r["created_at"][:10])

    keys = _month_keys()
    history = {}
    for loc in config.LOCALITIES:
        d = days.get(loc["name"], set())
        by_month = [sum(1 for day in d if day.startswith(k)) for k in keys]
        history[loc["name"]] = {"total": len(d), "by_month": by_month}
    return keys, history


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------
def _rain_text(total: float, horizon: int) -> str:
    span = f"in the next {horizon} hours"
    if total < 2.5:
        return f"Little or no rain expected {span}"
    if total < 35:
        return f"Light to moderate rain expected ({total:g} mm {span})"
    if total < 64.5:
        return f"Moderately heavy rain expected ({total:g} mm {span})"
    return f"Heavy rain expected ({total:g} mm {span})"


def _level(risk: float) -> str:
    if risk >= config.RISK_HIGH:
        return "high"
    if risk >= config.RISK_MEDIUM:
        return "medium"
    return "low"


def compute_forecast(conn, hotspots) -> dict:
    if _state["simulate"]:
        hourly, mode = _simulated_hourly(), "simulated"
    else:
        hourly = _live_hourly()
        mode = "live" if hourly is not None else "unavailable"

    month_keys, history = flood_history(conn)
    flooded_now = {h["area"] for h in hotspots}

    # City-wide hourly series (average across localities) for the chart
    city = None
    if hourly:
        series = [h for h in hourly.values() if h]
        n = min(len(s) for s in series) if series else 0
        city_hours = [
            {
                "time": series[0][i]["time"],
                "rain": round(sum(s[i]["rain"] for s in series) / len(series), 1),
                "prob": round(sum(s[i]["prob"] for s in series) / len(series)),
            }
            for i in range(n)
        ]
        city = {"hours": city_hours, "horizons": {}}
        for hz in HORIZONS:
            window = city_hours[:hz]
            peak = max(window, key=lambda x: x["rain"], default=None)
            city["horizons"][str(hz)] = {
                "total": round(sum(x["rain"] for x in window), 1),
                "peak_time": peak["time"] if peak else None,
                "peak_rain": peak["rain"] if peak else 0,
                "max_prob": max((x["prob"] for x in window), default=0),
            }

    areas = []
    for loc in config.LOCALITIES:
        name = loc["name"]
        hist = history[name]
        prone = loc.get("prone", 0.3)
        history_score = 0.5 * prone + 0.5 * min(hist["total"] / config.HISTORY_DAYS_FOR_MAX, 1)

        horizons = {}
        if hourly and hourly.get(name):
            hours = hourly[name]
            for hz in HORIZONS:
                window = hours[:hz]
                total = round(sum(x["rain"] for x in window), 1)
                peak = max((x["rain"] for x in window), default=0.0)
                rain_factor = min(
                    1.0,
                    0.7 * min(total / config.HEAVY_RAIN_MM_24H, 1) + 0.3 * min(peak / config.INTENSE_RAIN_MM_HR, 1),
                )
                risk = rain_factor * (0.2 + 0.8 * history_score)
                if name in flooded_now:
                    risk = min(1.0, risk + 0.1)

                reasons = [_rain_text(total, hz)]
                days = hist["total"]
                reasons.append(
                    f"Flooded on {days} {'day' if days == 1 else 'days'} in the past year"
                    if days
                    else "No floods recorded here in the past year"
                )
                if prone >= 0.7:
                    reasons.append("Low-lying, flood-prone area")
                if name in flooded_now:
                    reasons.append("Streets here are already flooded")

                horizons[str(hz)] = {
                    "risk": round(risk, 2),
                    "level": _level(risk),
                    "rain": total,
                    "reason": ". ".join(reasons) + ".",
                }

        areas.append(
            {
                "name": name,
                "lat": loc["lat"],
                "lng": loc["lng"],
                "prone": prone,
                "flooded_now": name in flooded_now,
                "history_total": hist["total"],
                "history_by_month": hist["by_month"],
                "horizons": horizons,
            }
        )

    return {
        "mode": mode,
        "updated_at": now_iso(),
        "horizons": list(HORIZONS),
        "months": month_keys,
        "city": city,
        "areas": areas,
    }
