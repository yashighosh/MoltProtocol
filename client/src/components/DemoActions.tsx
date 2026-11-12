import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

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
