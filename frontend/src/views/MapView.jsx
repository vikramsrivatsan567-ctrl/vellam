import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl } from "react-leaflet";
import { api } from "../api.js";
import { CHENNAI, LEVELS, SCORE_MAX, STATUS_LABELS, TILE_ATTRIBUTION, TILE_URL, timeAgo } from "../constants.js";
import { usePolling } from "../usePolling.js";

export default function MapView() {
  const { data, error } = usePolling(api.hotspots, 5000);
  const hotspots = data?.hotspots ?? [];
  const summary = data?.summary;

  return (
    <section className="mapview">
      <MapContainer center={CHENNAI} zoom={12} className="mapview__map" zoomControl={false}>
        <ZoomControl position="topright" />
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {[...hotspots].reverse().map((h) => {
          const color = LEVELS[h.level].color;
          return (
            <CircleMarker
              key={h.id}
              center={[h.lat, h.lng]}
              radius={9 + (Math.min(h.score, SCORE_MAX) / SCORE_MAX) * 16}
              pathOptions={{
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: h.status === "dispatched" ? 0.25 : 0.6,
                className: h.level === "critical" && h.status === "open" ? "pulse" : "",
              }}
            >
              <Popup>
                <div className="popup">
                  <p className="popup__level" style={{ color }}>
                    {LEVELS[h.level].label} priority
                  </p>
                  <h3>{h.area}</h3>
                  <p>
                    {h.depth_label}, reported by {h.reporters} {h.reporters === 1 ? "resident" : "residents"}, last{" "}
                    {timeAgo(h.latest_report_at)}
                  </p>
                  <p className="popup__status">{h.verified ? "Confirmed" : "Unverified"}</p>
                  {h.status === "dispatched" && <p className="popup__status">{STATUS_LABELS.dispatched}</p>}
                  {h.photo && <img src={h.photo} alt={`Flooding in ${h.area}`} />}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <aside className="legend">
        <h2 className="legend__title">Flooded streets right now</h2>
        {error ? (
          <p className="legend__error">{error}</p>
        ) : (
          <ul className="legend__list">
            {Object.entries(LEVELS).map(([key, lvl]) => (
              <li key={key}>
                <span className="legend__dot" style={{ background: lvl.color }} />
                <span className="legend__name">{lvl.label}</span>
                <span className="legend__count">{summary ? summary[key] : "–"}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="legend__foot">
          Bigger circles mean higher priority. Based on reports from the last {summary?.window_hours ?? 12} hours,
          refreshed every 5 seconds.
        </p>
        <p className="legend__foot">
          <a href="#outlook">See where flooding is likely in the next 48 hours</a>
        </p>
        <a className="btn btn--primary btn--block" href="#report">
          Report flooding
        </a>
      </aside>
    </section>
  );
}
