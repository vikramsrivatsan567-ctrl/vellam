import { useState } from "react";
import { api } from "../api.js";
import { usePolling } from "../usePolling.js";

// One-line summary of the flood outlook for officers, plus the demo rain switch.
export default function OutlookStrip() {
  const { data, refresh } = usePolling(api.forecast, 60000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const simulating = data?.mode === "simulated";
  const high = (data?.areas ?? []).filter((a) => a.horizons["24"]?.level === "high");

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await api.setSimulate(!simulating);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  let text = "Loading the flood outlook…";
  if (data?.mode === "unavailable") text = "The weather forecast can't be reached right now.";
  else if (data && high.length === 0) text = "No area is at high risk of flooding in the next 24 hours.";
  else if (data)
    text = `${high.length} ${high.length === 1 ? "area is" : "areas are"} at high risk of flooding in the next 24 hours: ${high
      .slice(0, 4)
      .map((a) => a.name)
      .join(", ")}${high.length > 4 ? " and more" : ""}.`;

  return (
    <div className="outlook-strip">
      <p className="outlook-strip__text">
        {text} <a href="#outlook">Open the flood outlook</a>
      </p>
      <button type="button" className="switch switch--light" aria-pressed={simulating} disabled={busy || !data} onClick={toggle}>
        <span className="switch__track">
          <span className="switch__thumb" />
        </span>
        Demo: simulate heavy rain
      </button>
      {error && <p className="outlook-strip__error">{error}</p>}
    </div>
  );
}
