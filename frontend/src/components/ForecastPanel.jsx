import { useState } from "react";
import { api } from "../api.js";
import { FORECAST_MODES, RISK_LEVELS } from "../constants.js";
import { usePolling } from "../usePolling.js";

export default function ForecastPanel() {
  const { data, error, refresh } = usePolling(api.forecast, 60000);
  const [busy, setBusy] = useState(false);
  const simulating = data?.mode === "simulated";
  const atRisk = (data?.areas ?? []).filter((a) => a.level !== "low");

  async function toggle() {
    setBusy(true);
    try {
      await api.setSimulate(!simulating);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="forecast" aria-labelledby="forecast-title">
      <div className="forecast__head">
        <div>
          <h2 id="forecast-title" className="forecast__title">
            Likely to flood in the next 24 hours
          </h2>
          <p className="forecast__mode">{error ? error : data ? FORECAST_MODES[data.mode] : "Loading forecast…"}</p>
        </div>
        <button type="button" className="switch" aria-pressed={simulating} disabled={busy || !data} onClick={toggle}>
          <span className="switch__track">
            <span className="switch__thumb" />
          </span>
          Simulate heavy rain
        </button>
      </div>

      {data && data.mode !== "unavailable" && atRisk.length === 0 && (
        <p className="forecast__empty">No area is at medium or high risk of flooding in the next 24 hours.</p>
      )}

      {atRisk.length > 0 && (
        <ul className="risk-list">
          {atRisk.slice(0, 6).map((a) => {
            const lvl = RISK_LEVELS[a.level];
            return (
              <li key={a.name} className="risk" style={{ "--level": lvl.color }}>
                <div className="risk__top">
                  <h3 className="risk__name">{a.name}</h3>
                  <span className="risk__level">{lvl.label}</span>
                </div>
                <div className="meter meter--thin">
                  <span className="meter__fill" style={{ width: `${Math.round(a.risk * 100)}%` }} />
                </div>
                <p className="risk__reason">{a.reason}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
