export const CHENNAI = [13.04, 80.23];

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// fill = how high the water rises on the gauge, in % of its height
export const DEPTHS = [
  { value: 1, label: "Ankle deep", short: "Ankle", hint: "Walkable, bikes struggle", fill: 9, color: "#6CC4D8" },
  { value: 2, label: "Knee deep", short: "Knee", hint: "Two-wheelers stall", fill: 25, color: "#1F8FB0" },
  { value: 3, label: "Waist deep", short: "Waist", hint: "Cars stall, unsafe to walk", fill: 47, color: "#E8A317" },
  { value: 4, label: "Impassable", short: "Chest", hint: "People may be stranded", fill: 80, color: "#D7263D" },
];

export const LEVELS = {
  critical: { label: "Critical", color: "#D7263D" },
  high: { label: "High", color: "#E8A317" },
  moderate: { label: "Moderate", color: "#1F8FB0" },
  low: { label: "Low", color: "#6CC4D8" },
};

export const RISK_LEVELS = {
  high: { label: "High risk", color: "#D7263D" },
  medium: { label: "Medium risk", color: "#E8A317" },
  low: { label: "Low risk", color: "#6CC4D8" },
};

// ---- Time helpers (forecast times arrive as GMT "YYYY-MM-DDTHH:MM") ----
const IST = "Asia/Kolkata";
const hourFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", timeZone: IST });
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: IST }); // YYYY-MM-DD
const weekdayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: IST });
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });

export const gmt = (t) => new Date(`${t}:00Z`);
export const hourLabel = (t) => hourFmt.format(gmt(t)).replace(" ", "\u202f");
export const hourOfDayIST = (t) => Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: IST }).format(gmt(t)));

export function dayLabel(t) {
  const day = dayFmt.format(gmt(t));
  const today = dayFmt.format(new Date());
  const tomorrow = dayFmt.format(new Date(Date.now() + 86400000));
  if (day === today) return "today";
  if (day === tomorrow) return "tomorrow";
  return weekdayFmt.format(gmt(t));
}

export const monthLabel = (key) => monthFmt.format(new Date(`${key}-01T00:00:00Z`));

// Rain category for a total, using India Meteorological Department (IMD) daily bands
export const RAIN_BANDS = [
  { min: 204.5, label: "Extremely heavy rain", short: "Extreme", color: "#8E1B3A" },
  { min: 115.6, label: "Very heavy rain", short: "Very heavy", color: "#D7263D" },
  { min: 64.5, label: "Heavy rain", short: "Heavy", color: "#E8A317" },
  { min: 15.6, label: "Moderate rain", short: "Moderate", color: "#1F8FB0" },
  { min: 2.5, label: "Light rain", short: "Light", color: "#6CC4D8" },
  { min: 0, label: "No significant rain", short: "None", color: "#9FB3C8" },
];
export const rainBand = (mm) => RAIN_BANDS.find((b) => mm >= b.min);

// Colour for a single hour's rainfall (mm per hour)
export function hourlyColor(mm) {
  if (mm >= 20) return "#D7263D";
  if (mm >= 7.6) return "#E8A317";
  if (mm >= 2.5) return "#1F8FB0";
  return "#6CC4D8";
}

export const STATUS_LABELS = {
  open: "Awaiting action",
  dispatched: "Crew dispatched",
  resolved: "Resolved",
};

// Score where the severity meter reads full
export const SCORE_MAX = 60;

export function timeAgo(iso) {
  if (!iso) return "";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr ago`;
}

export function mapsLink(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
