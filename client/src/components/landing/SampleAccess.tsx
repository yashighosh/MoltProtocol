import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useToast } from "../Toast";

const PEOPLE = [
  ["Ada Okonkwo", "ada.okonkwo@moltprotocol.demo"],
  ["Ravi Shah", "ravi.shah@moltprotocol.demo"],
];

export function SampleAccess() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast("✓ Copied the demo credential.");
  }

  async function signInAda() {
    setBusy(true);
    try {
      const result = await api<{ user: { id: string; email: string; displayName: string; isDemo: boolean; identityLabel: string } }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "ada.okonkwo@moltprotocol.demo", password: "demo-pass" }),
      });
      setUser(result.user);
      navigate("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" id="try">
      <div className="container sample-band">
        <div className="stack">
          <h2 className="display">Open the sample project</h2>
          <p className="lead">Both accounts are persisted demo identities. The Demo identity label stays on every review. Password for both: demo-pass.</p>
          <button type="button" className="pill" disabled={busy} onClick={() => void signInAda()}>{busy ? "Signing in…" : "Sign in as Ada"}</button>
        </div>
        <div className="identities">
          {PEOPLE.map(([name, email]) => (
            <div className="identity-row" key={email}>
              <div>
                <strong>{name}</strong>
                <p className="path">{email}</p>
                <p className="muted">Demo identity</p>
              </div>
              <button type="button" className="secondary" onClick={() => void copy(`${email} / demo-pass`)}>Copy</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
