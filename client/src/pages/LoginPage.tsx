import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth";
import { Logo } from "../components/Logo";
import type { SessionUser } from "../types";

const DEMOS = [
  { name: "Ada Okonkwo", email: "ada.okonkwo@moltprotocol.demo" },
  { name: "Ravi Shah", email: "ravi.shah@moltprotocol.demo" },
];

export function LoginForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setLocalError("Enter both the demo email and the password.");
      return;
    }
    setLocalError("");
    onSubmit(email.trim(), password);
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {(localError || error) && <p className="field-error" role="alert">{localError || error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Checking identity…" : "Sign in"}</button>
      <p className="login-note">Demo sign-in. These accounts are local identities for the workbench, and the demo label stays visible after you enter.</p>
      <div className="login-assist">
        {DEMOS.map((person) => (
          <button key={person.email} type="button" className="text-btn" onClick={() => { setEmail(person.email); setPassword("demo-pass"); setLocalError(""); }}>
            Use {person.name}
          </button>
        ))}
      </div>
      <p className="login-credentials">ada.okonkwo@moltprotocol.demo · ravi.shah@moltprotocol.demo · password demo-pass</p>
    </form>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(email: string, password: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: SessionUser }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setUser(result.user);
      navigate(result.user.role === "viewer" ? "/leadership" : "/dashboard");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-stage">
      <div className="login-frame">
        <section className="login-card">
          <header className="login-top">
            <Logo size={32} />
            <Link to="/">Back to the introduction</Link>
          </header>
          <h1>Sign in</h1>
          <p className="lead">Sign in before the codebase is treated as understood.</p>
          <LoginForm busy={busy} error={error} onSubmit={(email, password) => void onSubmit(email, password)} />
        </section>
        <aside className="login-visual" aria-hidden="true">
          <svg viewBox="0 0 560 640">
            <circle cx="300" cy="300" r="210" fill="var(--gold)" opacity="0.1" />
            <circle cx="300" cy="300" r="150" fill="none" stroke="var(--gold)" strokeWidth="1" opacity="0.35" />
            <g fill="none" stroke="var(--gold)" strokeWidth="1.5">
              <path d="M168 168 C220 168 230 168 250 168" />
              <path d="M360 168 C400 200 410 250 392 292" />
              <path d="M250 210 C250 260 250 280 292 320" />
              <path d="M168 210 C140 280 150 360 188 400" />
              <path d="M430 300 H490" stroke="var(--danger-ink)" strokeDasharray="5 4" />
            </g>
            <g fill="var(--night-800)" stroke="var(--night-text)">
              <rect x="48" y="132" width="150" height="78" rx="4" />
              <rect x="250" y="118" width="140" height="78" rx="4" />
              <rect x="250" y="292" width="150" height="78" rx="4" />
              <rect x="78" y="392" width="150" height="78" rx="4" stroke="var(--success-ink)" />
            </g>
            <rect x="456" y="268" width="88" height="72" rx="4" fill="none" stroke="var(--danger-ink)" strokeDasharray="5 4" />
            <g fill="var(--night-text)" fontFamily="IBM Plex Mono, monospace" fontSize="13">
              <text x="64" y="164">legacy</text>
              <text x="64" y="186">invoice.js</text>
              <text x="266" y="150">tax.js</text>
              <text x="266" y="172">confirmed</text>
              <text x="266" y="324">review</text>
              <text x="266" y="346">intent</text>
              <text x="94" y="424">map</text>
              <text x="94" y="446">edges</text>
              <text x="468" y="300" fill="var(--danger-ink)">missing</text>
              <text x="468" y="320" fill="var(--danger-ink)">rate.js</text>
            </g>
          </svg>
          <p>Parsed modules, confirmed edges, and the file a review still has to account for.</p>
        </aside>
      </div>
    </div>
  );
}
