import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { IntentSummaryView } from "../components/IntentSummaryView";
import { StatusBadge } from "../components/StatusBadge";
import type { IntentSummary } from "../types";

export function ReviewPage() {
  const { projectId } = useParams();
  const [reviews, setReviews] = useState<IntentSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [correction, setCorrection] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

  function load() {
    if (!projectId) return;
    api<{ reviews: IntentSummary[] }>(`/api/v1/projects/${projectId}/reviews`).then((result) => {
      setReviews(result.reviews);
      setSelectedId((current) => current || result.reviews[0]?.id || "");
    }).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => { load(); }, [projectId]);
  const selected = reviews?.find((item) => item.id === selectedId) ?? null;

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/summaries/${selected.id}/confirm`, { method: "POST" });
      setNotice("Confirmed. The reviewer identity and timestamp are stored with this version.");
      load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Confirm failed.");
    } finally {
      setBusy(false);
    }
  }

  async function correct(acknowledgeOverride: boolean) {
    if (!selected) return;
    if ((selected.status === "confirmed" || selected.status === "corrected") && !acknowledgeOverride) {
      setOverrideOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/summaries/${selected.id}/correct`, {
        method: "POST",
        body: JSON.stringify({ text: correction, acknowledgeOverride }),
      });
      setNotice("Correction stored. The previous text remains in the revision history.");
      setOverrideOpen(false);
      setCorrection("");
      load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Correction failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!projectId) return <p className="callout">Open a project from the workspace first.</p>;

  return (
    <div className="stack">
      <div>
        <h1>Intent validation</h1>
        <p className="lede">Confirm or correct an inferred summary. The signed-in demo identity is recorded. Reviewing one module does not stop analysis of the others.</p>
      </div>
      {error && <p className="callout error" role="alert">{error}</p>}
      {notice && <p className="callout" role="status">{notice}</p>}
      {reviews === null && <p aria-live="polite">Loading review queue…</p>}
      {reviews?.length === 0 && <p className="callout">Nothing is in the review queue. Generate summaries, then send a module from <Link to={`/intent-summaries/${projectId}`}>Intent summaries</Link>.</p>}
      {reviews && reviews.length > 0 && (
        <div className="split map">
          <ul className="stack">
            {reviews.map((item) => (
              <li key={item.id}>
                <button type="button" className="secondary" aria-pressed={item.id === selectedId} onClick={() => { setSelectedId(item.id); setNotice(""); }}>
                  <span className="path">{item.moduleName}</span> <StatusBadge status={item.status} />
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <div className="panel stack">
              <IntentSummaryView summary={selected} />
              <div className="row">
                <button type="button" disabled={busy || selected.status === "confirmed"} onClick={() => void confirm()}>Confirm as accurate</button>
              </div>
              <label>
                Corrected intent
                <textarea value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder="State the operational behavior this module is actually meant to perform." />
              </label>
              <button type="button" disabled={busy || correction.trim().length === 0} onClick={() => void correct(false)}>Submit correction</button>
              <h2>Revision history</h2>
              <ol>
                {(selected.revisions ?? []).map((revision) => (
                  <li key={revision.version}>
                    v{revision.version} {revision.action}
                    {revision.reviewerName ? ` by ${revision.reviewerName} (${revision.identityLabel})` : ""} at {new Date(revision.createdAt).toLocaleString()}
                    <div>{revision.text}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      {overrideOpen && (
        <div className="dialog-backdrop">
          <div className="dialog stack" role="dialog" aria-modal="true" aria-labelledby="override-title">
            <h2 id="override-title">Override a validated summary?</h2>
            <p>This replaces the current signed-off text. The previous version stays in the history.</p>
            <div className="row">
              <button type="button" className="danger" onClick={() => void correct(true)}>Override and save</button>
              <button type="button" className="secondary" onClick={() => setOverrideOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
