import { useEffect, useState } from "react";

// Officer session (token from the email-code sign-in), kept in this browser.
const KEY = "vellam-officer-session";
const EVENT = "vellam-auth-change";

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.token && new Date(s.expires_at) > new Date()) return s;
  } catch {
    /* no valid session */
  }
  return null;
}

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useSession() {
  const [session, setSession] = useState(getSession);
  useEffect(() => {
    const update = () => setSession(getSession());
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return session;
}
