# Vellam: live street flooding in Chennai

Residents report how deep the water is on their street. Vellam groups nearby
reports, ranks every flooded spot by priority, and alerts ward officers when a
location becomes critical.

## 1. Run the backend (terminal 1)

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload
```

On Mac/Linux, activate with `source venv/bin/activate` instead.
`python seed.py` loads about 24 demo reports. Run it again any time to reset the demo.
Leave this terminal running. API docs: http://localhost:8000/docs

## 2. Run the frontend (terminal 2)

Open a second terminal (the + in VS Code's terminal panel):

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

- `#report` : resident report page
- `#map` : live map
- `#dashboard` : officer priority list

## 3. Customise (backend/config.py)

- `CRITICAL_SITES` : hospitals/schools that boost priority. Coordinates are
  approximate, so check them on Google Maps.
- Scoring weights and the alert threshold.
- Alert email: fill in `SMTP_USER`, `SMTP_APP_PASSWORD` (a Gmail *app password*)
  and `ALERT_EMAIL_TO`. Without these, alerts still show on the dashboard.

## 4. Demo on your phone

Phones only share GPS over HTTPS. With both servers running, open a third terminal:

```
ngrok http 5173
```

Open the `https://....ngrok-free.app` link on your phone. The frontend forwards
API calls to the backend, so one tunnel is enough.
(Alternative: `cloudflared tunnel --url http://localhost:5173`)

## How priority is scored

Reports are grouped into ~110 m grid cells. Each cell scores:

- depth x 10 (ankle 1, knee 2, waist 3, impassable 4)
- +3 per report (up to 10 reports)
- +15 if a hospital or school is within 500 m
- +5 if the water is rising

Critical 40+, High 28+, Moderate 16+, otherwise Low. Critical cells trigger an alert.
Marking a spot resolved clears it; new reports after that reopen it.
