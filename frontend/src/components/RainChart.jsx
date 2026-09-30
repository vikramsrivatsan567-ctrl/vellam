import { useState } from "react";
import { dayLabel, hourLabel, hourOfDayIST, hourlyColor } from "../constants.js";

const W = 960;
const H = 270;
const PAD = { l: 44, r: 14, t: 30, b: 50 };

function niceMax(v) {
  return Math.max(10, Math.ceil(v / 5) * 5);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function RainChart({ hours, horizon }) {
  const [active, setActive] = useState(null);
  const n = hours.length;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const bw = plotW / n;
  const max = niceMax(Math.max(...hours.map((h) => h.rain)));
  const y = (mm) => PAD.t + plotH - (mm / max) * plotH;
  const x = (i) => PAD.l + i * bw;

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor((px - PAD.l) / bw);
    setActive(i >= 0 && i < n ? i : null);
  }

  const probPoints = hours.map((h, i) => `${x(i) + bw / 2},${PAD.t + plotH - (h.prob / 100) * plotH}`).join(" ");
  const a = active !== null ? hours[active] : null;
  const totalShown = hours.slice(0, horizon).reduce((s, h) => s + h.rain, 0);

  return (
    <section className="chart" aria-labelledby="chart-title">
      <div className="chart__head">
        <h2 id="chart-title" className="section-title">
          Rain hour by hour
        </h2>
        <p className="chart__hint">Hover or tap a bar to see that hour. Brighter bars are inside your selected time range.</p>
      </div>

      <div className="chart__scroll">
        <div className="chart__inner">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="chart__svg"
            role="img"
            aria-label={`Hourly rainfall for the next ${n} hours. ${Math.round(totalShown)} mm expected in the next ${horizon} hours.`}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setActive(null)}
          >
            {/* night bands (6 pm to 6 am IST) */}
            {hours.map((h, i) => {
              const hr = hourOfDayIST(h.time);
              return hr >= 18 || hr < 6 ? (
                <rect key={`n${i}`} x={x(i)} y={PAD.t} width={bw + 0.5} height={plotH} className="chart__night" />
              ) : null;
            })}

            {/* grid */}
            {[0, max / 2, max].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="chart__grid" />
                <text x={PAD.l - 8} y={y(v) + 4} className="chart__axis" textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            <text x={PAD.l - 8} y={PAD.t - 12} className="chart__axis" textAnchor="end">
              mm
            </text>

            {/* selected range bracket */}
            <line x1={x(0)} x2={x(horizon)} y1={PAD.t - 12} y2={PAD.t - 12} className="chart__range" />
            <text x={x(horizon) - 4} y={PAD.t - 17} className="chart__range-label" textAnchor="end">
              Next {horizon} hours
            </text>

            {/* bars */}
            {hours.map((h, i) => {
              const hgt = h.rain > 0 ? Math.max((h.rain / max) * plotH, 2) : 0;
              return (
                <rect
                  key={`b${i}`}
                  x={x(i) + 1.5}
                  y={PAD.t + plotH - hgt}
                  width={Math.max(bw - 3, 1)}
                  height={hgt}
                  rx={2}
                  fill={hourlyColor(h.rain)}
                  opacity={i < horizon ? 1 : 0.3}
                />
              );
            })}

            {/* chance of rain */}
            <polyline points={probPoints} className="chart__prob" />

            {/* x labels */}
            {hours.map((h, i) => {
              const hr = hourOfDayIST(h.time);
              const showHour = i === 0 || i % 3 === 0;
              return (
                <g key={`x${i}`}>
                  {showHour && (
                    <text x={x(i) + bw / 2} y={H - PAD.b + 18} className="chart__axis" textAnchor="middle">
                      {i === 0 ? "Now" : hourLabel(h.time)}
                    </text>
                  )}
                  {hr === 0 && i > 0 && (
                    <>
                      <line x1={x(i)} x2={x(i)} y1={PAD.t} y2={H - PAD.b + 26} className="chart__midnight" />
                      <text x={x(i) + 4} y={H - PAD.b + 38} className="chart__day">
                        {cap(dayLabel(h.time))}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* hover guide */}
            {a && <line x1={x(active) + bw / 2} x2={x(active) + bw / 2} y1={PAD.t} y2={PAD.t + plotH} className="chart__guide" />}
          </svg>

          {a && (
            <div
              className={`chart__tip ${active > n * 0.7 ? "is-left" : ""}`}
              style={{ left: `${((x(active) + bw / 2) / W) * 100}%` }}
            >
              <strong>
                {hourLabel(a.time)} {dayLabel(a.time)}
              </strong>
              <span>{a.rain} mm of rain</span>
              <span>{a.prob}% chance of rain</span>
            </div>
          )}
        </div>
      </div>

      <ul className="chart__legend">
        <li><span className="swatch" style={{ background: "#6CC4D8" }} /> Light, under 2.5 mm an hour</li>
        <li><span className="swatch" style={{ background: "#1F8FB0" }} /> Moderate, 2.5 to 7.6 mm</li>
        <li><span className="swatch" style={{ background: "#E8A317" }} /> Heavy, 7.6 to 20 mm</li>
        <li><span className="swatch" style={{ background: "#D7263D" }} /> Intense, over 20 mm</li>
        <li><span className="swatch swatch--line" /> Chance of rain</li>
        <li><span className="swatch swatch--night" /> Night</li>
      </ul>
    </section>
  );
}
