import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { IntentSummaryView } from "../components/IntentSummaryView";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
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

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
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
      await api(`/api/v1/summaries/${selected.id}/correct`, { method: "POST", body: JSON.stringify({ text: correction, acknowledgeOverride }) });
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

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Expert review" lede="Confirm or correct an inferred summary. The signed-in demo identity is recorded. Reviewing one module does not stop analysis of the others." />
      {error && <ErrorState message={error} />}
      {notice && <p className="callout" role="status">{notice}</p>}
      {reviews === null && !error && <Skeleton />}
      {reviews?.length === 0 && <EmptyState title="Nothing is in the review queue">Generate summaries, then send a module from <Link to={`/intent-summaries/${projectId}`}>Intent summaries</Link>.</EmptyState>}
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
            <div className="card stack">
              <IntentSummaryView summary={selected} showRationale />
              <button type="button" disabled={busy || selected.status === "confirmed"} onClick={() => void confirm()}>Confirm as accurate</button>
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
