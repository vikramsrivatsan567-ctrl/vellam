import { clearSession, getSession } from "./auth.js";

async function request(path, options = {}) {
  const session = getSession();
  const headers = { ...(options.headers || {}) };
  if (session) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new Error("Can't reach the server. Check that the backend is running on port 8000.");
  }
  if (!res.ok) {
    let msg = `Server returned ${res.status}.`;
    try {
      const body = await res.json();
      if (body.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* keep default message */
    }
    if (res.status === 401 && session) clearSession(); // session expired: back to sign-in
    throw new Error(msg);
  }
  return res.json();
}

const json = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  // public
  hotspots: () => request("/api/hotspots"),
  forecast: () => request("/api/forecast"),
  submitReport: (formData) => request("/api/reports", { method: "POST", body: formData }),

  // officer sign-in
  requestCode: (email) => request("/api/auth/request-code", json({ email })),
  verifyCode: (email, code) => request("/api/auth/verify", json({ email, code })),
  me: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  // officer only
  alerts: () => request("/api/alerts"),
  setSimulate: (enabled) => request("/api/forecast/simulate", json({ enabled })),
  markFalse: (id) => request(`/api/hotspots/${encodeURIComponent(id)}/false`, { method: "POST" }),
  setStatus: (id, status) => request(`/api/hotspots/${encodeURIComponent(id)}/status`, json({ status })),
};
