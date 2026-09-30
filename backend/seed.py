"""
Fills the database with realistic demo reports around Chennai.
WARNING: wipes existing reports first. Run:  python seed.py

Creates two kinds of data:
  1. Current flooding (last few hours) -> hotspots on the map and dashboard
  2. Past flood history (earlier this year) -> used by the flood risk forecast
"""
import random
from datetime import datetime, timedelta, timezone

import config
import db
from scoring import create_report

# Current flooding: (lat, lng, depths oldest -> newest, notes).
# Coordinates use exactly 3 decimals so the jitter keeps each report in one grid cell.
SCENARIOS = [
    (12.978, 80.218, [3, 3, 4, 3, 4], ["Water entering shops on the main road", "Bus stuck near the junction", "Rising fast, can't cross"]),
    (13.081, 80.277, [2, 3], ["Ambulance struggling to reach the hospital gate"]),
    (12.938, 80.212, [2, 3, 2], ["Marsh road completely under water"]),
    (13.022, 80.223, [2, 2, 2], ["Subway flooded, traffic diverted"]),
    (13.039, 80.233, [3, 2, 2], ["Waist deep outside the bus stop earlier", "Slowly draining now"]),
    (13.033, 80.269, [2, 2], ["Temple street waterlogged"]),
    (13.006, 80.257, [1, 2], []),
    (12.965, 80.245, [2], ["IT corridor service road flooded"]),
    (13.052, 80.226, [1, 1], []),
    (13.086, 80.211, [1], ["Small puddles near the park, walkable"]),
]

# Past flood history: locality -> number of distinct flood days in the past year
HISTORY = {
    "Velachery": 9, "Pallikaranai": 8, "T. Nagar": 6, "Saidapet": 5, "Perungudi": 5,
    "Adyar": 4, "Tambaram": 4, "Mylapore": 3, "Kodambakkam": 3, "Porur": 3,
    "Guindy": 2, "Egmore": 2, "Park Town": 2, "Anna Nagar": 1,
}


# Chennai floods mostly in the northeast monsoon (Oct to Dec), some in Jun to Sep
MONTH_WEIGHT = {10: 1.0, 11: 1.0, 12: 0.7, 1: 0.1, 6: 0.15, 7: 0.2, 8: 0.25, 9: 0.3}


def pick_flood_days(count: int) -> list:
    now = datetime.now(timezone.utc)
    chosen = set()
    while len(chosen) < count:
        day_ago = random.randint(3, 360)
        month = (now - timedelta(days=day_ago)).month
        if random.random() < MONTH_WEIGHT.get(month, 0.03):
            chosen.add(day_ago)
    return list(chosen)


def seed_device() -> str:
    return f"seed-{random.getrandbits(40):x}"


def main():
    db.reset_db()
    conn = db.get_conn()
    now = datetime.now(timezone.utc)

    total = 0
    for lat, lng, depths, notes in SCENARIOS:
        start_minutes = random.randint(60, 180)
        for i, depth in enumerate(depths):
            minutes_ago = max(2, start_minutes - i * random.randint(12, 30))
            created = (now - timedelta(minutes=minutes_ago)).isoformat(timespec="seconds")
            note = notes[i] if i < len(notes) else ""
            create_report(
                conn,
                lat + random.uniform(-0.0003, 0.0003),
                lng + random.uniform(-0.0003, 0.0003),
                depth,
                note,
                None,
                created_at=created,
                device_id=seed_device(),
            )
            total += 1

    past = 0
    places = {l["name"]: l for l in config.LOCALITIES}
    for name, flood_days in HISTORY.items():
        loc = places[name]
        for day_ago in pick_flood_days(flood_days):
            for _ in range(random.randint(1, 3)):
                created = (now - timedelta(days=day_ago, hours=random.randint(0, 12))).isoformat(timespec="seconds")
                conn.execute(
                    """INSERT INTO reports (lat, lng, cell_id, depth, note, photo, created_at, device_id)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (
                        loc["lat"] + random.uniform(-0.004, 0.004),
                        loc["lng"] + random.uniform(-0.004, 0.004),
                        "history",
                        random.choice([2, 2, 3, 3, 4]),
                        "",
                        None,
                        created,
                        seed_device(),
                    ),
                )
                past += 1
    conn.commit()
    conn.close()
    print(f"Seeded {total} current reports across {len(SCENARIOS)} locations.")
    print(f"Seeded {past} past reports as flood history for the forecast.")


if __name__ == "__main__":
    main()
