"""
Everything you might want to tweak lives in this file.
Edit the values, save, and the backend reloads automatically (uvicorn --reload).
"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "vellam.db")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
# Only reports from the last N hours count towards a hotspot.
REPORT_WINDOW_HOURS = 12

# Reports are grouped into grid cells by rounding lat/lng.
# 3 decimal places = cells of roughly 110 m x 110 m.
CELL_PRECISION = 3

DEPTH_WEIGHT = 10          # score per depth level (1 = ankle ... 4 = impassable)
REPORT_WEIGHT = 3          # score per independent report in the same cell
MAX_COUNTED_REPORTS = 10   # stop adding report points after this many
CRITICAL_SITE_BONUS = 15   # extra points if a hospital/school is nearby
RISING_BONUS = 5           # extra points if the latest report is deeper than the first
CRITICAL_SITE_RADIUS_M = 500

# Priority levels (score thresholds)
LEVEL_CRITICAL = 40
LEVEL_HIGH = 28
LEVEL_MODERATE = 16

# A hotspot at or above this score triggers an alert to authorities.
ALERT_THRESHOLD = LEVEL_CRITICAL

# ---------------------------------------------------------------------------
# Fake-report protection
# ---------------------------------------------------------------------------
RATE_LIMIT_PER_HOUR = 5            # max reports one device can send per hour
VERIFY_MIN_REPORTERS = 2           # different residents needed to mark a spot "confirmed"
REQUIRE_PHOTO_FOR_SEVERE = True    # waist-deep and impassable reports need a photo

# ---------------------------------------------------------------------------
# Flood risk forecast (weather + area history)
# ---------------------------------------------------------------------------
FORECAST_CACHE_SECONDS = 20 * 60   # re-download the weather forecast at most every 20 min
HEAVY_RAIN_MM_24H = 115            # 24 h rainfall that counts as fully "heavy"
INTENSE_RAIN_MM_HR = 30            # hourly rainfall that counts as fully "intense"
HISTORY_DAYS_FOR_MAX = 10          # flood days in the past year that count as maximum history
RISK_HIGH = 0.6
RISK_MEDIUM = 0.3

# ---------------------------------------------------------------------------
# Alert email (optional). Leave blank to skip sending; alerts still show
# on the officer dashboard.
# Use a Gmail *app password* (Google Account > Security > App passwords),
# not your normal Gmail password.
# ---------------------------------------------------------------------------
SMTP_USER = os.getenv("VELLAM_SMTP_USER", "")            # e.g. "you@gmail.com"
SMTP_APP_PASSWORD = os.getenv("VELLAM_SMTP_PASSWORD", "")  # 16-char app password
ALERT_EMAIL_TO = os.getenv("VELLAM_ALERT_TO", "")         # who receives alerts

# ---------------------------------------------------------------------------
# Officer sign-in (email code)
# ---------------------------------------------------------------------------
# Only these emails can sign in to the officer dashboard. Add your own email
# (and teammates') here. Uses the same Gmail settings above to send the code.
OFFICER_EMAILS = [
    "your.email@gmail.com",
    "officer@test.com",  # demo test account, remove before real use
]
OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_SECONDS = 30
SESSION_HOURS = 12
# Demo safety net: also print sign-in codes in the backend terminal, so you can
# sign in even if email fails at the venue. Turn this off for a real deployment.
PRINT_CODES_IN_TERMINAL = True

# ---------------------------------------------------------------------------
# Places
# ---------------------------------------------------------------------------
# Used to give each hotspot a readable area name (nearest locality wins),
# and as the areas shown in the flood risk forecast.
# "prone" (0 to 1) = how flood-prone the area is known to be. These are rough
# demo estimates; adjust them if you have better local knowledge.
LOCALITIES = [
    {"name": "Velachery", "lat": 12.9791, "lng": 80.2209, "prone": 0.9},
    {"name": "Pallikaranai", "lat": 12.9349, "lng": 80.2137, "prone": 0.9},
    {"name": "Perungudi", "lat": 12.9654, "lng": 80.2461, "prone": 0.7},
    {"name": "Adyar", "lat": 13.0012, "lng": 80.2565, "prone": 0.6},
    {"name": "Guindy", "lat": 13.0067, "lng": 80.2206, "prone": 0.4},
    {"name": "Saidapet", "lat": 13.0213, "lng": 80.2231, "prone": 0.6},
    {"name": "Mylapore", "lat": 13.0339, "lng": 80.2677, "prone": 0.5},
    {"name": "T. Nagar", "lat": 13.0418, "lng": 80.2341, "prone": 0.7},
    {"name": "Kodambakkam", "lat": 13.0521, "lng": 80.2255, "prone": 0.5},
    {"name": "Egmore", "lat": 13.0732, "lng": 80.2609, "prone": 0.4},
    {"name": "Park Town", "lat": 13.0800, "lng": 80.2750, "prone": 0.5},
    {"name": "Anna Nagar", "lat": 13.0850, "lng": 80.2101, "prone": 0.3},
    {"name": "Porur", "lat": 13.0382, "lng": 80.1565, "prone": 0.5},
    {"name": "Tambaram", "lat": 12.9249, "lng": 80.1000, "prone": 0.6},
]

# Hospitals, schools, subways etc. Flooding near these gets a priority boost.
# NOTE: coordinates are approximate. Check them on Google Maps and replace
# them with real sites near the areas you demo.
CRITICAL_SITES = [
    {"name": "Rajiv Gandhi Govt General Hospital", "type": "hospital", "lat": 13.0810, "lng": 80.2775},
    {"name": "Kilpauk Medical College Hospital", "type": "hospital", "lat": 13.0786, "lng": 80.2427},
    {"name": "Govt Royapettah Hospital", "type": "hospital", "lat": 13.0547, "lng": 80.2641},
    {"name": "Example school (replace me)", "type": "school", "lat": 12.9250, "lng": 80.1010},
]
