import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { Discrepancy } from "../types";

export function DiscrepancyPage() {
  const { projectId } = useParams();
  const [items, setItems] = useState<Discrepancy[] | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("not_started");
  const [severity, setSeverity] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    if (!projectId) return;
    api<{ items: Discrepancy[]; message: string; discrepancyStatus: string }>(`/api/v1/projects/${projectId}/discrepancies`).then((result) => {
      setItems(result.items);
      setMessage(result.message);
      setStatus(result.discrepancyStatus);
      setSelectedId((current) => current || result.items[0]?.id || "");
    }).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function detect() {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/projects/${projectId}/discrepancies/detect`, { method: "POST" });
      const started = Date.now();
      const timer = window.setInterval(() => {
        api<{ discrepancyStatus: string }>(`/api/v1/projects/${projectId}`).then((project) => {
          const current = project.discrepancyStatus;
          if (current === "complete" || current === "blocked" || current === "failed" || Date.now() - started > 20000) {
            window.clearInterval(timer);
            setBusy(false);
            load();
          }
        });
      }, 600);
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof ApiError ? reason.message : "Detection could not start.");
    }
  }

  async function mark(id: string, next: string) {
    await api(`/api/v1/discrepancies/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    load();
  }

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;
  const visible = (items ?? []).filter((item) => (severity === "all" || item.severity === severity) && (stateFilter === "all" || item.status === stateFilter));
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Discrepancies" lede="Comparison uses validated intent only. A flag is a potential mismatch in the static evidence, not proof of a runtime defect." actions={<button type="button" disabled={busy} onClick={() => void detect()}>{busy ? "Comparing…" : "Run discrepancy detection"}</button>} />
      {error && <ErrorState message={error} />}
      <StatusBadge status={status} />
      {message && <p className="callout" role="status">{message}</p>}
      {status === "blocked" && <p>Validate at least one summary in <Link to={`/intent-review/${projectId}`}>expert review</Link> before expecting a list.</p>}
      {items === null && !error && <Skeleton />}
      {items && items.length === 0 && status !== "blocked" && <EmptyState title="No discrepancies recorded">Run detection after at least one summary is confirmed or corrected. An empty list is not hidden: it means none were stored.</EmptyState>}
      {items && items.length > 0 && (
        <>
          <div className="row">
            <label>Severity
              <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>Status
              <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="potential">Potential</option>
                <option value="reviewed">Reviewed</option>
                <option value="confirmed">Confirmed mismatch</option>
              </select>
            </label>
          </div>
          <div className="split map">
            <table>
              <thead><tr><th>Rank</th><th>Module</th><th>Severity</th><th>Impact</th><th>Status</th></tr></thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className={selected?.id === item.id ? "selected" : ""}>
                    <td className="mono">{item.impactRank}</td>
                    <td>
                      <button type="button" className="quiet" aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>{item.moduleName}</button>
                    </td>
                    <td><StatusBadge status={item.severity} /></td>
                    <td className="mono">{item.impactScore}</td>
                    <td><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selected && (
              <article className="card stack">
                <h2>{selected.ruleId}</h2>
                <p>{selected.description}</p>
                <div className="split">
                  <div>
                    <h2>Code evidence</h2>
                    <pre className="code">{selected.codeExcerpt}</pre>
                  </div>
                  <div>
                    <h2>Validated intent</h2>
                    <p>{selected.intentText}</p>
                  </div>
                </div>
                <div className="bars">
                  {Object.entries(selected.factors).map(([key, value]) => (
                    <div className="bar-row" key={key}>
                      <span>{key}</span>
                      <i aria-hidden="true"><span style={{ width: `${Math.round(Number(value) * 100)}%` }} /></i>
                      <span className="mono">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="row">
                  <Link to={`/dependency-map/${projectId}?module=${selected.moduleId}`}>Open module on the map</Link>
                  <Link to={`/intent-summaries/${projectId}?summary=${selected.summaryId}`}>Open intent summary</Link>
                  <button type="button" className="secondary" onClick={() => void mark(selected.id, "reviewed")}>Mark reviewed</button>
                  <button type="button" onClick={() => void mark(selected.id, "confirmed")}>Confirm mismatch</button>
                </div>
              </article>
            )}
          </div>
        </>
      )}
    </div>
  );
}
