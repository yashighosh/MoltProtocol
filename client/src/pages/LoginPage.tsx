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
      <h1>Sign in</h1>
      <p className="callout">Demo sign-in. These accounts are persisted local identities for the workbench. They are not an enterprise directory, and the demo label stays visible after you enter.</p>
      <div className="row">
        {DEMOS.map((person) => (
          <button key={person.email} type="button" className="secondary" onClick={() => { setEmail(person.email); setPassword("demo-pass"); setLocalError(""); }}>
            Fill {person.name}
          </button>
        ))}
      </div>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {(localError || error) && <p className="field-error" role="alert">{localError || error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Checking identity…" : "Sign in"}</button>
      <p className="mono">Demo identity · ada.okonkwo@moltprotocol.demo · password demo-pass</p>
      <p className="mono">Demo identity · ravi.shah@moltprotocol.demo · password demo-pass</p>
      <Link to="/">Back to the introduction</Link>
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
      navigate("/dashboard");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-copy">
        <div className="hero-mesh" aria-hidden="true" />
        <Logo inverse />
        <h1>Sign in before the codebase is treated as understood.</h1>
        <p>The name on this session is the name stored when you confirm or correct an intent summary.</p>
      </section>
      <section className="login-panel">
        <LoginForm busy={busy} error={error} onSubmit={(email, password) => void onSubmit(email, password)} />
      </section>
    </div>
  );
}
