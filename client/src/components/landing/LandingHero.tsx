import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { OpenDemoButton } from "../DemoActions";
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
      <svg className="hero-nodes" viewBox="0 0 800 420" aria-hidden="true">
        <line x1="80" y1="160" x2="220" y2="90" /><line x1="220" y1="90" x2="360" y2="180" /><line x1="360" y1="180" x2="520" y2="80" /><line x1="520" y1="80" x2="680" y2="170" />
        <circle cx="80" cy="160" r="5" /><circle cx="220" cy="90" r="5" /><circle cx="360" cy="180" r="5" /><circle cx="520" cy="80" r="5" /><circle cx="680" cy="170" r="5" />
      </svg>
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
        <strong>Open the demonstration project</strong>
        <p>The bundled billing sample, run through ingest, map, summaries, one confirm, one correction, and discrepancy detection. Counts come from that run, not from a fixed caption.</p>
        <OpenDemoButton />
        <button type="button" className="secondary" disabled={busy} onClick={() => void loadSample()}>{busy ? "Loading sample…" : "Load sample only"}</button>
      </aside>
    </section>
  );
}
