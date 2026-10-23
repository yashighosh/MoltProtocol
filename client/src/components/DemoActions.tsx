import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export function OpenDemoButton({ label = "Open demo project" }: { label?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ projectId: string }>("/api/v1/demo/open", { method: "POST" });
      navigate(`/dashboard/${result.projectId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The demo project could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="demo-action">
      <button type="button" onClick={() => void open()} disabled={busy}>{busy ? "Opening demo…" : label}</button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}

export function ResetDemoButton({ onReset }: { onReset?: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reset() {
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/demo/reset", { method: "POST" });
      setOpen(false);
      onReset?.();
      navigate("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The demo project could not be reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>Reset demo project</button>
      {open && (
        <div className="dialog-backdrop">
          <div className="dialog stack" role="dialog" aria-modal="true" aria-labelledby="reset-demo-title">
            <h2 id="reset-demo-title">Reset the demonstration project?</h2>
            <p>This deletes the demonstration project, its reviews, and its discrepancies. Projects you created stay.</p>
            {error && <p role="alert">{error}</p>}
            <div className="row">
              <button type="button" disabled={busy} onClick={() => void reset()}>{busy ? "Resetting…" : "Reset demo project"}</button>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
