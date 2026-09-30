import smtplib
from email.message import EmailMessage

import config
import db


def email_configured() -> bool:
    return bool(config.SMTP_USER and config.SMTP_APP_PASSWORD)


def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plain-text email through Gmail. Returns True on success."""
    if not email_configured():
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = config.SMTP_USER
    msg["To"] = to
    msg.set_content(body)
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as smtp:
            smtp.login(config.SMTP_USER, config.SMTP_APP_PASSWORD)
            smtp.send_message(msg)
        return True
    except Exception as exc:  # never crash the app because of email
        print(f"[email] sending to {to} failed: {exc}")
        return False


def send_code_email(email: str, code: str) -> None:
    ok = send_email(
        email,
        f"Your Vellam officer sign-in code: {code}",
        f"Your sign-in code is {code}\n\nIt expires in {config.OTP_EXPIRY_MINUTES} minutes. "
        "If you didn't ask for this, you can ignore this email.\n",
    )
    if ok:
        print(f"[auth] code emailed to {email}")


def send_alert_email(alert: dict, hotspot: dict) -> None:
    """Runs in the background after a report crosses the alert threshold."""
    if not (config.SMTP_USER and config.SMTP_APP_PASSWORD and config.ALERT_EMAIL_TO):
        print(f"[alert] {hotspot['area']} scored {hotspot['score']} - email not configured, dashboard only")
        return

    sites = ", ".join(s["name"] for s in hotspot["critical_sites"]) or "None"
    maps_link = f"https://maps.google.com/?q={hotspot['lat']},{hotspot['lng']}"

    msg = EmailMessage()
    msg["Subject"] = f"[Vellam] Critical flooding in {hotspot['area']} (score {hotspot['score']})"
    msg["From"] = config.SMTP_USER
    msg["To"] = config.ALERT_EMAIL_TO
    msg.set_content(
        f"""A street in {hotspot['area']} has crossed the critical flooding threshold.

Water depth:        {hotspot['depth_label']}
Trend:              {hotspot['trend']}
Residents reporting: {hotspot['reporters']} ({'confirmed' if hotspot['verified'] else 'unverified'})
Priority score:     {hotspot['score']}
Near critical site: {sites}
Location:           {maps_link}

Latest notes from residents:
{chr(10).join('- ' + n for n in hotspot['notes']) or '- (none)'}

Open the officer dashboard to dispatch a crew.
"""
    )

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as smtp:
            smtp.login(config.SMTP_USER, config.SMTP_APP_PASSWORD)
            smtp.send_message(msg)
        conn = db.get_conn()
        conn.execute("UPDATE alerts SET emailed = 1 WHERE id = ?", (alert["id"],))
        conn.commit()
        conn.close()
        print(f"[alert] email sent for {hotspot['area']}")
    except Exception as exc:  # never crash the app because of email
        print(f"[alert] email failed: {exc}")
