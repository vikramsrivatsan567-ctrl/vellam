"""
Officer sign-in with a 6-digit email code.

1. Officer enters their email -> must be in config.OFFICER_EMAILS
2. A code is emailed (and printed in the terminal as a demo safety net)
3. Correct code -> a session token valid for config.SESSION_HOURS
Officer-only API routes use the require_officer dependency.
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Header, HTTPException

import config
import db


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def normalize(email: str) -> str:
    return (email or "").strip().lower()


def is_approved(email: str) -> bool:
    return email in {normalize(e) for e in config.OFFICER_EMAILS}


def create_code(conn, email: str) -> str:
    row = conn.execute("SELECT created_at FROM otp_codes WHERE email = ?", (email,)).fetchone()
    if row and row["created_at"] > _iso(_now() - timedelta(seconds=config.OTP_RESEND_SECONDS)):
        raise HTTPException(
            429, f"A code was just sent. Wait {config.OTP_RESEND_SECONDS} seconds before asking for another."
        )
    code = f"{secrets.randbelow(10**6):06d}"
    conn.execute(
        """INSERT INTO otp_codes (email, code_hash, expires_at, attempts, created_at) VALUES (?,?,?,0,?)
           ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at,
               attempts=0, created_at=excluded.created_at""",
        (email, _hash(code), _iso(_now() + timedelta(minutes=config.OTP_EXPIRY_MINUTES)), _iso(_now())),
    )
    conn.commit()
    return code


def verify_code(conn, email: str, code: str):
    row = conn.execute("SELECT * FROM otp_codes WHERE email = ?", (email,)).fetchone()
    if not row:
        raise HTTPException(400, "There's no active code for this email. Ask for a new one.")
    if row["expires_at"] < _iso(_now()):
        raise HTTPException(400, "This code has expired. Ask for a new one.")
    if row["attempts"] >= config.OTP_MAX_ATTEMPTS:
        raise HTTPException(429, "Too many wrong attempts. Ask for a new code.")
    if not hmac.compare_digest(row["code_hash"], _hash((code or "").strip())):
        conn.execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?", (email,))
        conn.commit()
        left = config.OTP_MAX_ATTEMPTS - row["attempts"] - 1
        raise HTTPException(400, f"That code isn't right. {left} {'attempt' if left == 1 else 'attempts'} left.")

    conn.execute("DELETE FROM otp_codes WHERE email = ?", (email,))
    token = secrets.token_urlsafe(32)
    expires = _iso(_now() + timedelta(hours=config.SESSION_HOURS))
    conn.execute(
        "INSERT INTO sessions (token_hash, email, expires_at, created_at) VALUES (?,?,?,?)",
        (_hash(token), email, expires, _iso(_now())),
    )
    conn.commit()
    return token, expires


def end_session(conn, token: str) -> None:
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash(token),))
    conn.commit()


def token_from_header(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:].strip()
    return None


def require_officer(authorization: Optional[str] = Header(None)) -> str:
    """FastAPI dependency: returns the officer's email or raises 401."""
    token = token_from_header(authorization)
    if not token:
        raise HTTPException(401, "Sign in as an officer to do this.")
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM sessions WHERE token_hash = ?", (_hash(token),)).fetchone()
    finally:
        conn.close()
    if not row or row["expires_at"] < _iso(_now()):
        raise HTTPException(401, "Your officer session has ended. Sign in again.")
    return row["email"]
