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
      <div className="hero-mesh" aria-hidden="true" />
      <header className="login-top">
        <Logo inverse size={32} />
        <Link to="/">Back to the introduction</Link>
      </header>
      <main className="login-center">
        <Logo inverse size={72} compact />
        <h1>Sign in before the codebase is treated as understood.</h1>
        <LoginForm busy={busy} error={error} onSubmit={(email, password) => void onSubmit(email, password)} />
      </main>
    </div>
  );
}
