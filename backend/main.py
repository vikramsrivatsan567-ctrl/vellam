import os
import uuid
from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import config
import db
from email_alert import send_alert_email
import auth
from email_alert import email_configured, send_code_email
from forecast import compute_forecast, is_simulating, set_simulation
from scoring import compute_hotspots, create_report, mark_false, now_iso, reports_in_last_hour, set_status

db.init_db()

app = FastAPI(title="Vellam API", description="Street-level waterlogging reports for Chennai")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
MAX_PHOTO_BYTES = 10 * 1024 * 1024


def get_db():
    conn = db.get_conn()
    try:
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Officer sign-in
# ---------------------------------------------------------------------------
class CodeRequest(BaseModel):
    email: str


class CodeVerify(BaseModel):
    email: str
    code: str


@app.post("/api/auth/request-code")
def request_code(body: CodeRequest, background: BackgroundTasks, conn=Depends(get_db)):
    email = auth.normalize(body.email)
    if "@" not in email:
        raise HTTPException(400, "Enter a valid email address.")
    if not auth.is_approved(email):
        raise HTTPException(403, "This email isn't on the approved officer list. Ask your administrator to add it.")
    code = auth.create_code(conn, email)
    if config.PRINT_CODES_IN_TERMINAL:
        print(f"[auth] sign-in code for {email}: {code}")
    background.add_task(send_code_email, email, code)
    return {"ok": True, "email_configured": email_configured(), "expires_minutes": config.OTP_EXPIRY_MINUTES}


@app.post("/api/auth/verify")
def verify(body: CodeVerify, conn=Depends(get_db)):
    email = auth.normalize(body.email)
    token, expires = auth.verify_code(conn, email, body.code)
    return {"token": token, "email": email, "expires_at": expires}


@app.get("/api/auth/me")
def me(officer=Depends(auth.require_officer)):
    return {"email": officer}


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None), conn=Depends(get_db)):
    token = auth.token_from_header(authorization)
    if token:
        auth.end_session(conn, token)
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"ok": True, "time": now_iso()}


@app.post("/api/reports")
async def submit_report(
    background: BackgroundTasks,
    lat: float = Form(...),
    lng: float = Form(...),
    depth: int = Form(...),
    note: str = Form(""),
    device_id: str = Form(""),
    photo: Optional[UploadFile] = File(None),
    conn=Depends(get_db),
):
    if depth not in (1, 2, 3, 4):
        raise HTTPException(400, "Depth must be 1 (ankle), 2 (knee), 3 (waist) or 4 (impassable).")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(400, "Location is not valid. Set the pin on the map and try again.")

    device_id = device_id.strip()[:64]
    if device_id and reports_in_last_hour(conn, device_id) >= config.RATE_LIMIT_PER_HOUR:
        raise HTTPException(
            429,
            f"You've sent {config.RATE_LIMIT_PER_HOUR} reports in the last hour. Try again later.",
        )

    has_photo = photo is not None and bool(photo.filename)
    if config.REQUIRE_PHOTO_FOR_SEVERE and depth >= 3 and not has_photo:
        raise HTTPException(
            400,
            "Add a photo for waist-deep or impassable water. These reports alert officers, so they need a photo.",
        )

    filename = None
    if photo is not None and photo.filename:
        ext = os.path.splitext(photo.filename)[1].lower() or ".jpg"
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, "Photo must be a JPG, PNG, WEBP or HEIC image.")
        data = await photo.read()
        if len(data) > MAX_PHOTO_BYTES:
            raise HTTPException(400, "Photo is larger than 10 MB. Choose a smaller one.")
        filename = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(config.UPLOAD_DIR, filename), "wb") as f:
            f.write(data)

    report, hotspot, alert, updated = create_report(
        conn, lat, lng, depth, note.strip()[:500], filename, device_id=device_id
    )
    if alert and hotspot:
        background.add_task(send_alert_email, alert, hotspot)

    return {"report": report, "hotspot": hotspot, "alert_triggered": alert is not None, "updated": updated}


@app.get("/api/hotspots")
def list_hotspots(conn=Depends(get_db)):
    hotspots, summary = compute_hotspots(conn)
    return {"hotspots": hotspots, "summary": summary, "generated_at": now_iso()}


class StatusUpdate(BaseModel):
    status: str


@app.post("/api/hotspots/{cell_id}/status")
def update_status(cell_id: str, body: StatusUpdate, conn=Depends(get_db), officer=Depends(auth.require_officer)):
    if body.status not in ("open", "dispatched", "resolved"):
        raise HTTPException(400, "Status must be open, dispatched or resolved.")
    set_status(conn, cell_id, body.status)
    return {"ok": True, "cell_id": cell_id, "status": body.status}


@app.post("/api/hotspots/{cell_id}/false")
def flag_false(cell_id: str, conn=Depends(get_db), officer=Depends(auth.require_officer)):
    removed = mark_false(conn, cell_id)
    return {"ok": True, "cell_id": cell_id, "reports_removed": removed}


@app.get("/api/forecast")
def forecast(conn=Depends(get_db)):
    hotspots, _ = compute_hotspots(conn)
    return compute_forecast(conn, hotspots)


class SimulateUpdate(BaseModel):
    enabled: bool


@app.post("/api/forecast/simulate")
def simulate(body: SimulateUpdate, officer=Depends(auth.require_officer)):
    set_simulation(body.enabled)
    return {"ok": True, "simulating": is_simulating()}


@app.get("/api/alerts")
def list_alerts(conn=Depends(get_db), officer=Depends(auth.require_officer)):
    """Unacknowledged alerts for hotspots that are still critical right now."""
    hotspots, _ = compute_hotspots(conn)
    live = {h["id"]: h for h in hotspots if h["score"] >= config.ALERT_THRESHOLD and h["status"] == "open"}
    rows = conn.execute(
        "SELECT * FROM alerts WHERE acknowledged = 0 ORDER BY created_at DESC"
    ).fetchall()
    alerts = []
    for r in rows:
        h = live.get(r["cell_id"])
        if h:
            alerts.append({**dict(r), "score": h["score"], "depth_label": h["depth_label"]})
    return {
        "alerts": alerts,
        "email_configured": bool(config.SMTP_USER and config.SMTP_APP_PASSWORD and config.ALERT_EMAIL_TO),
    }
