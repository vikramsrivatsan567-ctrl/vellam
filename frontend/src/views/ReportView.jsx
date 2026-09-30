import { useEffect, useState } from "react";
import DepthGauge from "../components/DepthGauge.jsx";
import LocationPicker from "../components/LocationPicker.jsx";
import { api } from "../api.js";
import { LEVELS } from "../constants.js";
import { getDeviceId } from "../device.js";

export default function ReportView() {
  const [depth, setDepth] = useState(null);
  const [location, setLocation] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const severe = depth >= 3;
  const photoMissing = severe && !photo;
  const canSubmit = depth && location && !photoMissing && !submitting;

  const missing = [];
  if (!depth) missing.push("choose the water depth");
  if (!location) missing.push("set the location");
  if (photoMissing) missing.push("add a photo");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    const form = new FormData();
    form.append("lat", location.lat);
    form.append("lng", location.lng);
    form.append("depth", depth);
    form.append("note", note);
    form.append("device_id", getDeviceId());
    if (photo) form.append("photo", photo);
    try {
      setResult(await api.submitReport(form));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setDepth(null);
    setPhoto(null);
    setNote("");
    setResult(null);
    setError("");
  }

  if (result) {
    const h = result.hotspot;
    const level = h ? LEVELS[h.level] : null;
    return (
      <section className="report report--done">
        <div className="done" style={{ "--level": level ? level.color : "#1F8FB0" }}>
          <h1 className="done__title">{result.updated ? "Report updated" : "Report sent"}</h1>
          {result.updated && (
            <p className="done__lead">
              You'd already reported this spot, so your earlier report was updated instead of being counted twice.
            </p>
          )}
          {h && (
            <p className="done__lead">
              This street in {h.area} is now <strong>{level.label.toLowerCase()} priority</strong>, based on{" "}
              {h.reporters} {h.reporters === 1 ? "resident" : "residents"}.
            </p>
          )}
          {result.alert_triggered && (
            <p className="done__alert">Ward officers have been alerted about this location.</p>
          )}
          <div className="done__actions">
            <button className="btn btn--primary" onClick={reset}>
              Report another spot
            </button>
            <a className="btn btn--ghost" href="#map">
              See it on the live map
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form className="report" onSubmit={handleSubmit}>
      <section className="report__depth">
        <h1 className="report__title">How deep is the water where you are?</h1>
        <p className="report__lead">
          Your report goes straight to the ward officers' priority list. Pick the level that matches the water on the
          street.
        </p>
        <DepthGauge value={depth} onChange={setDepth} />
      </section>

      <section className="report__details">
        <div className="field">
          <h2 className="field__title">Where is it?</h2>
          <LocationPicker value={location} onChange={setLocation} />
        </div>

        <div className="field">
          <h2 className="field__title">
            Add a photo{" "}
            <span className={severe ? "field__required" : "field__optional"}>{severe ? "required" : "optional"}</span>
          </h2>
          {severe && (
            <p className="field__hint">
              Waist-deep and impassable reports alert officers, so they need a photo of the water.
            </p>
          )}
          <label className="photo-drop">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            />
            {preview ? (
              <img src={preview} alt="Selected flood photo" />
            ) : (
              <span>Take or choose a photo of the water</span>
            )}
          </label>
          {photo && (
            <button type="button" className="link-btn" onClick={() => setPhoto(null)}>
              Remove photo
            </button>
          )}
        </div>

        <div className="field">
          <h2 className="field__title">
            Anything officers should know? <span className="field__optional">optional</span>
          </h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="For example: water entering houses, an elderly person needs help, vehicle stuck"
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--big" disabled={!canSubmit}>
          {submitting ? "Sending report…" : "Send report"}
        </button>
        {missing.length > 0 && (
          <p className="report__todo">
            To send, {missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`}.
          </p>
        )}
      </section>
    </form>
  );
}
