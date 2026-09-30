import { useState } from "react";
import { api } from "../api.js";
import { usePolling } from "../usePolling.js";
import RainHero from "../components/RainHero.jsx";
import RainChart from "../components/RainChart.jsx";
import AreaOutlook from "../components/AreaOutlook.jsx";

const MODE_TEXT = {
  live: "Live weather forecast from Open-Meteo, combined with each area's flood history.",
  simulated: "Showing simulated heavy rain for the demo, combined with each area's flood history.",
  unavailable: "The weather forecast can't be reached right now, so only past flood history is shown.",
};

export default function OutlookView() {
  const { data, error } = usePolling(api.forecast, 60000);
  const [horizon, setHorizon] = useState(24);
  const [selected, setSelected] = useState(null);

  return (
    <section className="outlook">
      <header className="outlook__head">
        <div>
          <h1 className="outlook__title">Flood outlook</h1>
          <p className="outlook__sub">{error ? error : data ? MODE_TEXT[data.mode] : "Loading the forecast…"}</p>
        </div>
        <div className="segmented" role="group" aria-label="Time range">
          {(data?.horizons ?? [6, 24, 48]).map((hz) => (
            <button key={hz} type="button" aria-pressed={horizon === hz} onClick={() => setHorizon(hz)}>
              <span className="segmented__next">Next </span>
              {hz} hours
            </button>
          ))}
        </div>
      </header>

      {data?.city && (
        <RainHero summary={data.city.horizons[String(horizon)]} horizon={horizon} simulated={data.mode === "simulated"} />
      )}

      {data?.mode === "unavailable" && (
        <div className="notice">
          Rain forecasts will appear here once the weather service is reachable. Officers can turn on simulated heavy
          rain from their dashboard to demo the full outlook.
        </div>
      )}

      {data?.city && <RainChart hours={data.city.hours} horizon={horizon} />}

      {data && (
        <AreaOutlook
          areas={data.areas}
          months={data.months}
          horizon={horizon}
          selected={selected}
          onSelect={setSelected}
        />
      )}

      <section className="how">
        <h2 className="section-title">How this outlook works</h2>
        <p>
          For each area, we combine the rain forecast with how often that area has flooded in the past year and whether
          it's known to be low-lying. Heavy rain over an area that floods often means higher risk. Streets that are
          flooded right now raise the risk further. It's an estimate to help people plan ahead, not a guarantee.
        </p>
      </section>
    </section>
  );
}
