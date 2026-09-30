import { DEPTHS } from "../constants.js";

function Figure() {
  return (
    <svg className="gauge__figure" viewBox="0 0 100 200" aria-hidden="true">
      <circle cx="50" cy="17" r="13" />
      <rect x="33" y="34" width="34" height="64" rx="12" />
      <rect x="21" y="37" width="10" height="56" rx="5" />
      <rect x="69" y="37" width="10" height="56" rx="5" />
      <rect x="35" y="88" width="13" height="112" rx="6" />
      <rect x="52" y="88" width="13" height="112" rx="6" />
    </svg>
  );
}

export default function DepthGauge({ value, onChange }) {
  const current = DEPTHS.find((d) => d.value === value);
  const fill = current ? current.fill : 0;

  return (
    <div className="gauge">
      <div className="gauge__visual" aria-hidden="true">
        <div className="gauge__staff">
          {DEPTHS.map((d) => (
            <span
              key={d.value}
              className={`gauge__tick ${value === d.value ? "is-active" : ""}`}
              style={{ bottom: `${d.fill}%` }}
            >
              {d.short}
            </span>
          ))}
        </div>
        <div className="gauge__scene">
          <Figure />
          <div
            className={`gauge__water ${fill ? "" : "is-empty"}`}
            style={{ height: `${fill}%`, "--wc": current ? current.color : "#6CC4D8" }}
          />
          <div className="gauge__ground" />
        </div>
      </div>

      <div className="gauge__options" role="radiogroup" aria-label="Water depth">
        {[...DEPTHS].reverse().map((d) => (
          <button
            key={d.value}
            type="button"
            role="radio"
            aria-checked={value === d.value}
            className="depth-option"
            style={{ "--level": d.color }}
            onClick={() => onChange(d.value)}
          >
            <span className="depth-option__swatch" />
            <span className="depth-option__text">
              <span className="depth-option__label">{d.label}</span>
              <span className="depth-option__hint">{d.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
