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
      <section className="login-auth">
        <header className="login-top">
          <Logo size={32} />
          <Link to="/">Back to the introduction</Link>
        </header>
        <div className="login-copy">
          <h1>Sign in</h1>
          <p className="lead">Sign in before the codebase is treated as understood.</p>
          <LoginForm busy={busy} error={error} onSubmit={(email, password) => void onSubmit(email, password)} />
        </div>
      </section>
      <aside className="login-visual" aria-hidden="true">
        <svg viewBox="0 0 640 720">
          <rect width="640" height="720" fill="var(--night-900)" />
          <g fill="none" stroke="var(--gold)" strokeWidth="1.25">
            <path d="M120 180 H250" />
            <path d="M330 180 H470" />
            <path d="M250 180 C290 180 290 340 330 340" />
            <path d="M250 180 C290 180 290 520 330 520" />
            <path d="M470 340 H560" strokeDasharray="5 4" stroke="var(--danger-ink)" />
          </g>
          <g fill="var(--night-800)" stroke="var(--night-text)" strokeWidth="1">
            <rect x="48" y="148" width="132" height="64" rx="4" />
            <rect x="198" y="148" width="132" height="64" rx="4" />
            <rect x="330" y="308" width="140" height="64" rx="4" />
            <rect x="330" y="488" width="140" height="64" rx="4" stroke="var(--success-ink)" />
          </g>
          <rect x="500" y="308" width="108" height="64" rx="4" fill="none" stroke="var(--danger-ink)" strokeDasharray="5 4" />
          <g fill="var(--night-text)" fontFamily="IBM Plex Mono, monospace" fontSize="13">
            <text x="64" y="176">legacy</text>
            <text x="64" y="196">invoice.js</text>
            <text x="214" y="176">tax.js</text>
            <text x="214" y="196">confirmed</text>
            <text x="346" y="336">review</text>
            <text x="346" y="356">intent</text>
            <text x="346" y="516">map</text>
            <text x="346" y="536">edges</text>
            <text x="514" y="336" fill="var(--danger-ink)">missing</text>
            <text x="514" y="356" fill="var(--danger-ink)">rate.js</text>
          </g>
        </svg>
        <p>Parsed modules, confirmed edges, and the file a review still has to account for.</p>
      </aside>
    </div>
  );
}
