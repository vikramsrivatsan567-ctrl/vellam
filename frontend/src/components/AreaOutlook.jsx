import { useEffect } from "react";
import { Circle, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { CHENNAI, RISK_LEVELS, TILE_ATTRIBUTION, TILE_URL, monthLabel } from "../constants.js";

const NO_FORECAST = "#9FB3C8";

function FlyTo({ area }) {
  const map = useMap();
  useEffect(() => {
    if (area) map.flyTo([area.lat, area.lng], 13, { duration: 0.6 });
  }, [area?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function HistoryBars({ counts, months, max }) {
  return (
    <div className="history">
      <div className="history__bars" aria-hidden="true">
        {counts.map((c, i) => (
          <span
            key={months[i]}
            className={`history__bar ${c ? "has-floods" : ""}`}
            style={{ height: `${c ? 18 + (c / max) * 82 : 6}%` }}
            title={`${monthLabel(months[i])}: ${c} flood ${c === 1 ? "day" : "days"}`}
          />
        ))}
      </div>
      <div className="history__months" aria-hidden="true">
        <span>{monthLabel(months[0])}</span>
        <span>{monthLabel(months[months.length - 1])}</span>
      </div>
    </div>
  );
}

export default function AreaOutlook({ areas, months, horizon, selected, onSelect }) {
  const h = String(horizon);
  const sorted = [...areas].sort(
    (a, b) => (b.horizons[h]?.risk ?? -1) - (a.horizons[h]?.risk ?? -1) || b.history_total - a.history_total
  );
  const maxMonth = Math.max(1, ...areas.flatMap((a) => a.history_by_month));
  const selectedArea = areas.find((a) => a.name === selected);

  return (
    <section className="areas" aria-labelledby="areas-title">
      <div className="areas__head">
        <h2 id="areas-title" className="section-title">
          Which areas may flood
        </h2>
        <p className="chart__hint">
          Ranked by risk for the next {horizon} hours. Each area's past year of floods is shown as monthly bars.
        </p>
      </div>

      <div className="areas__grid">
        <div className="areas__map">
          <MapContainer center={CHENNAI} zoom={11} scrollWheelZoom={false}>
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <FlyTo area={selectedArea} />
            {sorted.map((a) => {
              const f = a.horizons[h];
              const color = f ? RISK_LEVELS[f.level].color : NO_FORECAST;
              const isSel = a.name === selected;
              return (
                <Circle
                  key={a.name}
                  center={[a.lat, a.lng]}
                  radius={1300}
                  eventHandlers={{ click: () => onSelect(a.name) }}
                  pathOptions={{
                    color: isSel ? "#13243B" : color,
                    weight: isSel ? 4 : 2,
                    fillColor: color,
                    fillOpacity: f ? 0.12 + f.risk * 0.4 : 0.12,
                  }}
                >
                  <Tooltip direction="center" permanent className="area-label">
                    {a.name}
                  </Tooltip>
                </Circle>
              );
            })}
          </MapContainer>
        </div>

        <ol className="area-list">
          {sorted.map((a) => {
            const f = a.horizons[h];
            const lvl = f ? RISK_LEVELS[f.level] : null;
            const isSel = a.name === selected;
            return (
              <li key={a.name}>
                <button
                  type="button"
                  className={`area ${isSel ? "is-selected" : ""}`}
                  style={{ "--level": lvl ? lvl.color : NO_FORECAST }}
                  aria-expanded={isSel}
                  onClick={() => onSelect(isSel ? null : a.name)}
                >
                  <span className="area__main">
                    <span className="area__top">
                      <span className="area__name">{a.name}</span>
                      {a.flooded_now && <span className="tag tag--rising">Flooded now</span>}
                    </span>
                    <span className="area__risk">{lvl ? lvl.label : "No forecast"}</span>
                    <span className="meter meter--thin">
                      <span className="meter__fill" style={{ width: `${f ? Math.round(f.risk * 100) : 0}%` }} />
                    </span>
                    <span className="area__rain">
                      {f ? `${f.rain} mm of rain expected` : "Rain forecast unavailable"}
                    </span>
                  </span>
                  <span className="area__history">
                    <HistoryBars counts={a.history_by_month} months={months} max={maxMonth} />
                    <span className="area__history-label">
                      {a.history_total} flood {a.history_total === 1 ? "day" : "days"} in the past year
                    </span>
                  </span>
                  {isSel && f && <span className="area__reason">{f.reason}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
