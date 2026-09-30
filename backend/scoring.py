"""
Turns raw reports into ranked hotspots.

A hotspot = all recent reports that fall in the same ~110 m grid cell.
Score = depth + number of reports + nearby hospital/school + rising water.
"""
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import config

DEPTH_LABELS = {1: "Ankle deep", 2: "Knee deep", 3: "Waist deep", 4: "Impassable"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def cell_id_for(lat: float, lng: float) -> str:
    p = config.CELL_PRECISION
    return f"{round(lat, p):.{p}f}_{round(lng, p):.{p}f}"


def nearest_locality(lat: float, lng: float) -> str:
    best = min(config.LOCALITIES, key=lambda l: haversine_m(lat, lng, l["lat"], l["lng"]))
    if haversine_m(lat, lng, best["lat"], best["lng"]) > 4000:
        return "Outer Chennai"
    return best["name"]


def critical_sites_near(lat: float, lng: float) -> list:
    return [
        {"name": s["name"], "type": s["type"]}
        for s in config.CRITICAL_SITES
        if haversine_m(lat, lng, s["lat"], s["lng"]) <= config.CRITICAL_SITE_RADIUS_M
    ]


def level_for(score: int) -> str:
    if score >= config.LEVEL_CRITICAL:
        return "critical"
    if score >= config.LEVEL_HIGH:
        return "high"
    if score >= config.LEVEL_MODERATE:
        return "moderate"
    return "low"


def compute_hotspots(conn):
    """Return (hotspots sorted by score desc, summary dict)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=config.REPORT_WINDOW_HOURS)).isoformat(
        timespec="seconds"
    )
    rows = conn.execute(
        "SELECT * FROM reports WHERE created_at >= ? AND status = 'active' ORDER BY created_at ASC", (cutoff,)
    ).fetchall()
    statuses = {r["cell_id"]: r for r in conn.execute("SELECT * FROM hotspot_status").fetchall()}

    cells = defaultdict(list)
    for r in rows:
        st = statuses.get(r["cell_id"])
        if st and st["reset_at"] and r["created_at"] <= st["reset_at"]:
            continue  # this report was already handled when the cell was resolved
        cells[r["cell_id"]].append(r)

    hotspots = []
    for cell_id, reports in cells.items():
        lat = sum(r["lat"] for r in reports) / len(reports)
        lng = sum(r["lng"] for r in reports) / len(reports)
        max_depth = max(r["depth"] for r in reports)
        count = len(reports)
        # One device counts once, however many times it reports the same spot
        reporters = len({r["device_id"] or f"anon-{r['id']}" for r in reports})
        sites = critical_sites_near(lat, lng)

        first, latest = reports[0], reports[-1]
        if count > 1 and latest["depth"] > first["depth"]:
            trend = "rising"
        elif count > 1 and latest["depth"] < first["depth"]:
            trend = "falling"
        else:
            trend = "steady"

        score = max_depth * config.DEPTH_WEIGHT
        score += min(reporters, config.MAX_COUNTED_REPORTS) * config.REPORT_WEIGHT
        if sites:
            score += config.CRITICAL_SITE_BONUS
        if trend == "rising":
            score += config.RISING_BONUS

        st = statuses.get(cell_id)
        status = st["status"] if st else "open"
        if status == "resolved":
            status = "open"  # new reports arrived after it was resolved

        photos = [r["photo"] for r in reports if r["photo"]]
        notes = [r["note"] for r in reversed(reports) if r["note"]][:3]

        hotspots.append(
            {
                "id": cell_id,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "area": nearest_locality(lat, lng),
                "report_count": count,
                "reporters": reporters,
                "verified": reporters >= config.VERIFY_MIN_REPORTERS,
                "max_depth": max_depth,
                "depth_label": DEPTH_LABELS[max_depth],
                "latest_depth": latest["depth"],
                "trend": trend,
                "critical_sites": sites,
                "score": score,
                "level": level_for(score),
                "status": status,
                "first_report_at": first["created_at"],
                "latest_report_at": latest["created_at"],
                "photo": f"/uploads/{photos[-1]}" if photos else None,
                "notes": notes,
            }
        )

    hotspots.sort(key=lambda h: (h["score"], h["latest_report_at"]), reverse=True)

    resolved_recently = conn.execute(
        "SELECT COUNT(*) FROM hotspot_status WHERE status = 'resolved' AND updated_at >= ?", (cutoff,)
    ).fetchone()[0]
    summary = {
        "critical": sum(1 for h in hotspots if h["level"] == "critical"),
        "high": sum(1 for h in hotspots if h["level"] == "high"),
        "moderate": sum(1 for h in hotspots if h["level"] == "moderate"),
        "low": sum(1 for h in hotspots if h["level"] == "low"),
        "total_reports": sum(h["report_count"] for h in hotspots),
        "resolved_recently": resolved_recently,
        "window_hours": config.REPORT_WINDOW_HOURS,
    }
    return hotspots, summary


def create_report(conn, lat, lng, depth, note="", photo=None, created_at=None, device_id=""):
    """Store a report, then check whether its cell now needs an alert.

    If the same device already reported this cell recently, its earlier report
    is updated instead, so one person can't push a street up the list.

    Returns (report_dict, hotspot_dict, alert_dict_or_None, updated_bool).
    """
    created_at = created_at or now_iso()
    cell_id = cell_id_for(lat, lng)

    existing = None
    if device_id:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=config.REPORT_WINDOW_HOURS)).isoformat(
            timespec="seconds"
        )
        st = conn.execute("SELECT reset_at FROM hotspot_status WHERE cell_id = ?", (cell_id,)).fetchone()
        if st and st["reset_at"] and st["reset_at"] > cutoff:
            cutoff = st["reset_at"]
        existing = conn.execute(
            """SELECT * FROM reports WHERE device_id = ? AND cell_id = ? AND status = 'active'
               AND created_at > ? ORDER BY created_at DESC LIMIT 1""",
            (device_id, cell_id, cutoff),
        ).fetchone()

    if existing:
        conn.execute(
            "UPDATE reports SET lat=?, lng=?, depth=?, note=?, photo=COALESCE(?, photo), created_at=? WHERE id=?",
            (lat, lng, depth, note, photo, created_at, existing["id"]),
        )
        report_id = existing["id"]
    else:
        cur = conn.execute(
            """INSERT INTO reports (lat, lng, cell_id, depth, note, photo, created_at, device_id)
               VALUES (?,?,?,?,?,?,?,?)""",
            (lat, lng, cell_id, depth, note, photo, created_at, device_id),
        )
        report_id = cur.lastrowid
    conn.commit()
    report = {
        "id": report_id, "lat": lat, "lng": lng, "cell_id": cell_id,
        "depth": depth, "note": note, "created_at": created_at,
    }

    hotspots, _ = compute_hotspots(conn)
    hotspot = next((h for h in hotspots if h["id"] == cell_id), None)

    alert = None
    if hotspot and hotspot["score"] >= config.ALERT_THRESHOLD and hotspot["status"] != "dispatched":
        st = conn.execute("SELECT reset_at FROM hotspot_status WHERE cell_id = ?", (cell_id,)).fetchone()
        since = st["reset_at"] if st and st["reset_at"] else ""
        already = conn.execute(
            "SELECT id FROM alerts WHERE cell_id = ? AND created_at > ?", (cell_id, since)
        ).fetchone()
        if not already:
            cur = conn.execute(
                "INSERT INTO alerts (cell_id, area, score, level, created_at) VALUES (?,?,?,?,?)",
                (cell_id, hotspot["area"], hotspot["score"], hotspot["level"], now_iso()),
            )
            conn.commit()
            alert = {"id": cur.lastrowid, "cell_id": cell_id, "area": hotspot["area"], "score": hotspot["score"]}

    return report, hotspot, alert, existing is not None


def reports_in_last_hour(conn, device_id: str) -> int:
    since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(timespec="seconds")
    return conn.execute(
        "SELECT COUNT(*) FROM reports WHERE device_id = ? AND created_at >= ?", (device_id, since)
    ).fetchone()[0]


def mark_false(conn, cell_id: str) -> int:
    """Officer flags a hotspot as fake: its current reports stop counting."""
    cur = conn.execute("UPDATE reports SET status = 'false' WHERE cell_id = ? AND status = 'active'", (cell_id,))
    conn.execute("UPDATE alerts SET acknowledged = 1 WHERE cell_id = ?", (cell_id,))
    conn.commit()
    return cur.rowcount


def set_status(conn, cell_id: str, status: str) -> None:
    now = now_iso()
    existing = conn.execute("SELECT reset_at FROM hotspot_status WHERE cell_id = ?", (cell_id,)).fetchone()
    reset_at = now if status == "resolved" else (existing["reset_at"] if existing else None)
    conn.execute(
        """INSERT INTO hotspot_status (cell_id, status, updated_at, reset_at) VALUES (?,?,?,?)
           ON CONFLICT(cell_id) DO UPDATE SET status=excluded.status,
               updated_at=excluded.updated_at, reset_at=excluded.reset_at""",
        (cell_id, status, now, reset_at),
    )
    if status in ("dispatched", "resolved"):
        conn.execute("UPDATE alerts SET acknowledged = 1 WHERE cell_id = ?", (cell_id,))
    conn.commit()
