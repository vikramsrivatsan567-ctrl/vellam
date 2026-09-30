import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { LEVELS, SCORE_MAX, STATUS_LABELS, mapsLink, timeAgo } from "../constants.js";
import { usePolling } from "../usePolling.js";
import OutlookStrip from "../components/OutlookStrip.jsx";
import { clearSession, useSession } from "../auth.js";

function AlertBanner({ alerts, emailConfigured }) {
  if (!alerts.length) return null;
  return (
    <div className="alert-banner" role="alert">
      <p className="alert-banner__title">
        {alerts.length === 1
          ? "1 location needs immediate action"
          : `${alerts.length} locations need immediate action`}
      </p>
      <p className="alert-banner__places">{alerts.map((a) => `${a.area} (${a.depth_label.toLowerCase()})`).join(", ")}</p>
      <p className="alert-banner__note">
        {emailConfigured
          ? "Alert emails have been sent to the ward office."
          : "Alert email isn't set up yet, so these alerts only show here."}
      </p>
    </div>
  );
}

function HotspotRow({ h, rank, flash, busy, onStatus, onFalse }) {
  const level = LEVELS[h.level];
  const pct = Math.min(h.score / SCORE_MAX, 1) * 100;
  const classes = ["hs", `hs--${h.level}`, h.status === "dispatched" && "is-dispatched", flash && "is-updated"]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={classes} style={{ "--level": level.color }}>
      <span className="hs__rank" aria-label={`Rank ${rank}`}>
        {rank}
      </span>

      <div className="hs__main">
        <h3 className="hs__area">{h.area}</h3>
        <p className="hs__meta">
          {h.depth_label}, {h.reporters} {h.reporters === 1 ? "resident" : "residents"}, last report{" "}
          {timeAgo(h.latest_report_at)}
        </p>
        <div className="hs__tags">
          {h.verified ? (
            <span className="tag tag--confirmed">Confirmed by {h.reporters} residents</span>
          ) : (
            <span className="tag tag--unverified">Unverified, 1 resident</span>
          )}
          {h.trend === "rising" && <span className="tag tag--rising">Water rising</span>}
          {h.trend === "falling" && <span className="tag">Water falling</span>}
          {h.critical_sites.map((s) => (
            <span key={s.name} className="tag tag--site">
              Near {s.name}
            </span>
          ))}
          {h.status === "dispatched" && <span className="tag tag--dispatched">{STATUS_LABELS.dispatched}</span>}
        </div>
        {h.notes[0] && <p className="hs__note">“{h.notes[0]}”</p>}
      </div>

      <div className="hs__severity">
        <div className="meter" role="img" aria-label={`Priority score ${h.score}, ${level.label}`}>
          <span className="meter__fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="hs__score">
          <span className="hs__score-num">{h.score}</span> {level.label}
        </p>
      </div>

      {h.photo ? (
        <a className="hs__photo" href={h.photo} target="_blank" rel="noreferrer">
          <img src={h.photo} alt={`Flooding in ${h.area}`} />
        </a>
      ) : (
        <span className="hs__photo hs__photo--none">No photo</span>
      )}

      <div className="hs__actions">
        {h.status === "open" && (
          <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => onStatus(h.id, "dispatched")}>
            Dispatch crew
          </button>
        )}
        <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => onStatus(h.id, "resolved")}>
          Mark resolved
        </button>
        <div className="hs__links">
          <a className="hs__link" href={mapsLink(h.lat, h.lng)} target="_blank" rel="noreferrer">
            Directions
          </a>
          <button
            type="button"
            className="hs__link hs__link--false"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Mark the current reports for ${h.area} as false? They'll be removed from the list.`)) {
                onFalse(h.id);
              }
            }}
          >
            Mark as false
          </button>
        </div>
      </div>
    </li>
  );
}

export default function DashboardView() {
  const session = useSession();
  const { data, error, refresh } = usePolling(api.hotspots, 4000);
  const { data: alertData, refresh: refreshAlerts } = usePolling(api.alerts, 4000);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [flash, setFlash] = useState({});
  const prevScores = useRef(null);

  // Highlight rows that are new or whose score went up since the last poll
  useEffect(() => {
    if (!data) return;
    const scores = {};
    const changed = {};
    for (const h of data.hotspots) {
      scores[h.id] = h.score;
      if (prevScores.current && (prevScores.current[h.id] === undefined || h.score > prevScores.current[h.id])) {
        changed[h.id] = true;
      }
    }
    prevScores.current = scores;
    if (Object.keys(changed).length) {
      setFlash(changed);
      const t = setTimeout(() => setFlash({}), 2600);
      return () => clearTimeout(t);
    }
  }, [data]);

  async function handleStatus(id, status) {
    setBusyId(id);
    setActionError("");
    try {
      if (status === "false") await api.markFalse(id);
      else await api.setStatus(id, status);
      await Promise.all([refresh(), refreshAlerts()]);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const hotspots = data?.hotspots ?? [];
  const summary = data?.summary;

  return (
    <section className="dash">
      <div className="dash__account">
        <span>Signed in as {session?.email}</span>
        <button
          type="button"
          className="link-btn"
          onClick={async () => {
            try {
              await api.logout();
            } finally {
              clearSession();
            }
          }}
        >
          Sign out
        </button>
      </div>
      <div className="dash__head">
        <div>
          <h1 className="dash__title">Priority list</h1>
          <p className="dash__sub">
            Flooded streets ranked by severity. Refreshes every few seconds as residents report.
          </p>
        </div>
        {summary && (
          <dl className="dash__summary">
            {Object.entries(LEVELS).map(([key, lvl]) => (
              <div key={key} style={{ "--level": lvl.color }}>
                <dt>{lvl.label}</dt>
                <dd>{summary[key]}</dd>
              </div>
            ))}
            <div className="is-resolved">
              <dt>Resolved</dt>
              <dd>{summary.resolved_recently}</dd>
            </div>
          </dl>
        )}
      </div>

      <AlertBanner alerts={alertData?.alerts ?? []} emailConfigured={alertData?.email_configured} />

      <OutlookStrip />

      <h2 className="dash__section">Flooded now</h2>

      {(error || actionError) && (
        <p className="form-error" role="alert">
          {actionError || error}
        </p>
      )}

      {data && hotspots.length === 0 && (
        <div className="empty">
          <p>No flooded streets reported in the last {summary?.window_hours ?? 12} hours.</p>
          <p>New reports appear here within seconds.</p>
        </div>
      )}

      <ol className="hs-list">
        {hotspots.map((h, i) => (
          <HotspotRow
            key={h.id}
            h={h}
            rank={i + 1}
            flash={flash[h.id]}
            busy={busyId === h.id}
            onStatus={handleStatus}
            onFalse={(id) => handleStatus(id, "false")}
          />
        ))}
      </ol>
    </section>
  );
}
