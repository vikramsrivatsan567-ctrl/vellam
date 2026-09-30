import { useState } from "react";
import { api } from "../api.js";
import { saveSession } from "../auth.js";

export default function OfficerSignIn() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.requestCode(email);
      setInfo(res);
      setStep("code");
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.verifyCode(email, code);
      saveSession(res);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="signin">
      <div className="signin__card">
        <svg className="signin__icon" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 4 8 10v12c0 10 7 18.5 16 22 9-3.5 16-12 16-22V10L24 4z" fill="#13243B" />
          <path d="M16 26c2.7-2.2 5.3-2.2 8 0s5.3 2.2 8 0" fill="none" stroke="#6CC4D8" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <h1 className="signin__title">Officer sign-in</h1>

        {step === "email" ? (
          <form onSubmit={sendCode} className="signin__form">
            <p className="signin__lead">
              The priority list and crew actions are for ward officers only. Enter your approved email and we'll send
              you a 6-digit code.
            </p>
            <label className="input-label" htmlFor="officer-email">
              Work email
            </label>
            <input
              id="officer-email"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn--primary btn--big" disabled={busy || !email}>
              {busy ? "Sending code…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="signin__form">
            <p className="signin__lead">
              {info?.email_configured ? (
                <>
                  We sent a 6-digit code to <strong>{email}</strong>. It expires in {info.expires_minutes} minutes.
                </>
              ) : (
                <>
                  Email sending isn't set up yet, so the code for <strong>{email}</strong> was printed in the backend
                  terminal. It expires in {info?.expires_minutes ?? 10} minutes.
                </>
              )}
            </p>
            <label className="input-label" htmlFor="officer-code">
              Sign-in code
            </label>
            <input
              id="officer-code"
              className="input input--code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              autoFocus
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn--primary btn--big" disabled={busy || code.length !== 6}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="signin__alt">
              <button type="button" className="link-btn" onClick={() => sendCode()} disabled={busy}>
                Send a new code
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setStep("email");
                  setError("");
                }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
