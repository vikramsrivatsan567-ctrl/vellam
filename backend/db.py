import os
import sqlite3

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    cell_id TEXT NOT NULL,
    depth INTEGER NOT NULL,
    note TEXT DEFAULT '',
    photo TEXT,
    created_at TEXT NOT NULL,
    device_id TEXT DEFAULT '',
    status TEXT DEFAULT 'active'   -- active | false (marked fake by an officer)
);
CREATE INDEX IF NOT EXISTS idx_reports_cell ON reports(cell_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

CREATE TABLE IF NOT EXISTS hotspot_status (
    cell_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,          -- open | dispatched | resolved
    updated_at TEXT NOT NULL,
    reset_at TEXT                  -- reports before this time are ignored (set on resolve)
);

CREATE TABLE IF NOT EXISTS otp_codes (
    email TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cell_id TEXT NOT NULL,
    area TEXT,
    score INTEGER,
    level TEXT,
    created_at TEXT NOT NULL,
    emailed INTEGER DEFAULT 0,
    acknowledged INTEGER DEFAULT 0
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# Columns added after the first version. Older databases get them automatically.
MIGRATIONS = [
    ("reports", "device_id", "TEXT DEFAULT ''"),
    ("reports", "status", "TEXT DEFAULT 'active'"),
]


def init_db() -> None:
    os.makedirs(config.UPLOAD_DIR, exist_ok=True)
    conn = get_conn()
    conn.executescript(SCHEMA)
    for table, column, decl in MIGRATIONS:
        columns = [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]
        if column not in columns:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")
    conn.commit()
    conn.close()


def reset_db() -> None:
    conn = get_conn()
    conn.executescript(
        "DROP TABLE IF EXISTS reports; DROP TABLE IF EXISTS hotspot_status; DROP TABLE IF EXISTS alerts;"
    )
    conn.commit()
    conn.close()
    init_db()
