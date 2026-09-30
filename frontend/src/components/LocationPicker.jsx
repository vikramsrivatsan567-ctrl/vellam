import { useCallback, useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { CHENNAI, TILE_ATTRIBUTION, TILE_URL } from "../constants.js";

function ClickToPlace({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng, source: "map" });
    },
  });
  return null;
}

function FollowPin({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16));
  }, [position?.lat, position?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const GEO_ERRORS = {
  1: "Location permission was denied. Tap the map to place the pin instead.",
  2: "Your location isn't available right now. Tap the map to place the pin instead.",
  3: "Finding your location took too long. Tap the map to place the pin instead.",
};

export default function LocationPicker({ value, onChange }) {
  const [status, setStatus] = useState("");

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("This browser can't share location. Tap the map to place the pin.");
      return;
    }
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "gps" });
        setStatus(`Location found, accurate to about ${Math.round(pos.coords.accuracy)} m.`);
      },
      (err) => setStatus(GEO_ERRORS[err.code] || GEO_ERRORS[2]),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [onChange]);

  useEffect(() => {
    locate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="locpick">
      <div className="locpick__bar">
        <button type="button" className="btn btn--ghost" onClick={locate}>
          Use my current location
        </button>
        <span className="locpick__status" role="status">
          {value && value.source === "map" ? "Pin placed on the map." : status}
        </span>
      </div>
      <div className="locpick__map">
        <MapContainer center={CHENNAI} zoom={12} scrollWheelZoom={false}>
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <ClickToPlace onPick={onChange} />
          <FollowPin position={value} />
          {value && (
            <CircleMarker
              center={[value.lat, value.lng]}
              radius={10}
              pathOptions={{ color: "#13243B", weight: 3, fillColor: "#1F8FB0", fillOpacity: 0.9 }}
            />
          )}
        </MapContainer>
      </div>
      <p className="locpick__help">Wrong spot? Tap the map where the water is.</p>
    </div>
  );
}
