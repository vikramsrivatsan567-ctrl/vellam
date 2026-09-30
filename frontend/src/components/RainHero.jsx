import { useMemo } from "react";
import { RAIN_BANDS, dayLabel, hourLabel, rainBand } from "../constants.js";

const GAUGE_MAX = 250; // mm shown at the top of the rain gauge
const BUCKET_LITRES = 15;

export default function RainHero({ summary, horizon, simulated }) {
  const total = summary.total;
  const band = rainBand(total);
  const pct = Math.min(total / GAUGE_MAX, 1) * 100;
  const streakCount = Math.min(70, Math.round(total / 2));

  // Fixed pseudo-random layout so streaks don't jump on every refresh
  const streaks = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: ((i * 37) % 100) + ((i * 13) % 10) / 10,
        delay: (((i * 53) % 100) / 100) * 1.4,
        dur: 0.55 + ((i * 29) % 40) / 100,
        len: 14 + ((i * 7) % 20),
      })),
    []
  );

  const headline =
    total < 2.5 ? `No significant rain in the next ${horizon} hours` : `${band.label} expected in the next ${horizon} hours`;
  const buckets = Math.round(total / BUCKET_LITRES);

  return (
    <section className="rainhero" style={{ "--band": band.color }}>
      <div className="rainhero__streaks" aria-hidden="true">
        {streaks.slice(0, streakCount).map((s, i) => (
          <span
            key={i}
            className="streak"
            style={{
              left: `${s.left}%`,
              height: `${s.len}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="rainhero__text">
        {simulated && <p className="rainhero__sim">Simulated heavy rain for the demo</p>}
        <h2 className="rainhero__headline">{headline}</h2>

        {total >= 1 ? (
          <p className="rainhero__explain">
            {total} mm of rain means about <strong>{Math.round(total)} litres of water</strong> falling on every square
            metre of ground.{" "}
            {buckets >= 1
              ? `That's like emptying ${buckets} ${buckets === 1 ? "bucket" : "buckets"} of water onto each square metre of road.`
              : "That's less than a bucket of water per square metre of road."}
          </p>
        ) : (
          <p className="rainhero__explain">Streets should drain normally. Existing waterlogging may still take time to clear.</p>
        )}

        <dl className="rainhero__facts">
          {summary.peak_time && summary.peak_rain >= 0.5 && (
            <div>
              <dt>Heaviest rain</dt>
              <dd>
                Around {hourLabel(summary.peak_time)} {dayLabel(summary.peak_time)}, {summary.peak_rain} mm in one hour
              </dd>
            </div>
          )}
          <div>
            <dt>Chance of rain</dt>
            <dd>Up to {summary.max_prob}%</dd>
          </div>
        </dl>
      </div>

      <div className="raingauge" role="img" aria-label={`${total} millimetres of rain expected, ${band.label.toLowerCase()}`}>
        <div className="raingauge__tube">
          <div className="raingauge__water" style={{ height: `${pct}%` }}>
            <span className="raingauge__value">{Math.round(total)} mm</span>
          </div>
          {RAIN_BANDS.filter((b) => b.min >= 15).map((b) => (
            <span key={b.short} className="raingauge__tick" style={{ bottom: `${(b.min / GAUGE_MAX) * 100}%` }}>
              {b.short}
            </span>
          ))}
        </div>
        <p className="raingauge__caption">Expected rainfall</p>
      </div>
    </section>
  );
}
