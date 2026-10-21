import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PillButton } from "../PillButton";

export function LandingHero() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function loadSample() {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ projectId: string }>("/api/v1/projects/sample", { method: "POST", body: JSON.stringify({ name: "Sample legacy billing" }) });
      navigate(`/ingestion/${result.projectId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hero" id="product">
      <div className="hero-mesh" aria-hidden="true" />
      <div className="container">
        <p className="eyebrow">Intent-aware modernization</p>
        <h1>Understand the code before you replace it.</h1>
        <p className="sub">Legacy systems carry rules nobody wrote down.</p>
        <div className="row">
          <PillButton to={user ? "/dashboard" : "/login"}>Get started</PillButton>
          <PillButton href="#method" variant="ghost">See how it works</PillButton>
        </div>
      </div>
      <aside className="float-card">
        <p className="eyebrow">Sample</p>
        <strong>Try the bundled sample</strong>
        <p>A small billing codebase with a missing ledger import, a low-confidence scratch file, and files that parsing cannot accept.</p>
        <button type="button" className="pill" disabled={busy} onClick={() => void loadSample()}>{busy ? "Loading sample…" : "Load sample"}</button>
      </aside>
    </section>
  );
}
