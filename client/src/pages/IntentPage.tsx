import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { CodeViewer } from "../components/CodeViewer";
import { Drawer } from "../components/Drawer";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { IntentSummaryView } from "../components/IntentSummaryView";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { Tabs } from "../components/Tabs";
import type { GraphNode, IntentSummary, Project } from "../types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "inferred", label: "Inferred" },
  { id: "queued", label: "Queued" },
  { id: "validated", label: "Validated" },
  { id: "low", label: "Low confidence" },
];

export function IntentPage() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [summaries, setSummaries] = useState<IntentSummary[] | null>(null);
  const [detail, setDetail] = useState<IntentSummary | null>(null);
  const [related, setRelated] = useState<GraphNode[]>([]);
  const [modeNote, setModeNote] = useState("");
  const [filter, setFilter] = useState("all");
  const [cluster, setCluster] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState("");
  const selectedId = params.get("summary");

  function load() {
    if (!projectId) return;
    api<Project>(`/api/v1/projects/${projectId}`).then(setProject).catch((reason: Error) => setError(reason.message));
    api<{ summaries: IntentSummary[]; demonstration: boolean }>(`/api/v1/projects/${projectId}/summaries`).then((result) => {
      setSummaries(result.summaries);
      setModeNote(result.demonstration ? "Demonstration mode is on. Confidence is scored from evidence in the repository, not from a model." : "A live model rewrote the wording. Confidence is still the local evidence score.");
    }).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const directories = [...new Set((summaries ?? []).map((item) => item.moduleName.split("/").slice(0, -1).join("/") || "(root)"))];
  const visible = (summaries ?? []).filter((item) => {
    const directory = item.moduleName.split("/").slice(0, -1).join("/") || "(root)";
    if (cluster !== "all" && directory !== cluster) return false;
    if (filter === "inferred") return item.status === "inferred";
    if (filter === "queued") return item.queuedForReview && item.status === "inferred";
    if (filter === "validated") return item.status === "confirmed" || item.status === "corrected";
    if (filter === "low") return item.confidence === "low";
    return true;
  });
  const clusterRollup = useMemo(() => {
    if (cluster === "all" || visible.length === 0) return null;
    const lowest = visible.some((item) => item.confidence === "low") ? "low" : visible.some((item) => item.confidence === "medium") ? "medium" : "high";
    return { lowest, text: visible.map((item) => `${item.moduleName}: ${item.text}`).join(" ") };
  }, [cluster, visible]);

  useEffect(() => {
    if (!projectId || !selectedId) {
      setDetail(null);
      return;
    }
    api<IntentSummary>(`/api/v1/summaries/${selectedId}`).then(setDetail).catch(() => setDetail(null));
  }, [projectId, selectedId, summaries]);

  useEffect(() => {
    if (!projectId || !detail) return;
    api<{ source: string | null }>(`/api/v1/projects/${projectId}/files/source?path=${encodeURIComponent(detail.moduleName)}`)
      .then((result) => setSource(result.source ?? ""))
      .catch(() => setSource(""));
    api<{ callers: { module?: GraphNode }[]; callees: { module?: GraphNode }[] }>(`/api/v1/projects/${projectId}/modules/${detail.moduleId}`)
      .then((result) => setRelated([...(result.callers.map((item) => item.module).filter(Boolean) as GraphNode[]), ...(result.callees.map((item) => item.module).filter(Boolean) as GraphNode[])]))
      .catch(() => setRelated([]));
  }, [projectId, detail]);

  async function generate() {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/projects/${projectId}/summaries/generate`, { method: "POST" });
      const started = Date.now();
      const timer = window.setInterval(() => {
        api<Project>(`/api/v1/projects/${projectId}`).then((result) => {
          if (result.summaryStatus === "complete" || result.summaryStatus === "failed" || Date.now() - started > 30000) {
            window.clearInterval(timer);
            setBusy(false);
            load();
          }
        });
      }, 700);
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof ApiError ? reason.message : "Could not start summarization.");
    }
  }

  async function queue(ids: string[]) {
    setError("");
    try {
      for (const id of ids) await api(`/api/v1/summaries/${id}/queue`, { method: "POST" });
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not queue review.");
    }
  }

  if (!projectId) return <EmptyState title="Open a project first">Intent summaries belong to one ingested codebase. <Link to="/workspace">Open projects</Link></EmptyState>;

  const highlighted = new Set<number>();
  if (detail) {
    for (const item of detail.evidence) {
      for (let line = item.startLine; line <= item.endLine; line += 1) highlighted.add(line);
    }
  }

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Intent summaries" lede="Each summary is inferred. Low confidence stays flagged. Source ranges are the lines the reading actually used." actions={project?.analysisStatus === "complete" ? <button type="button" disabled={busy} onClick={() => void generate()}>{busy ? "Generating…" : "Generate intent summaries"}</button> : undefined} />
      {error && <ErrorState message={error} />}
      {project && project.analysisStatus !== "complete" && <p className="callout">Dependency analysis has not finished. Summaries use those modules. <Link to={`/dependency-map/${projectId}`}>Open the map</Link></p>}
      {summaries === null && !error && <Skeleton />}
      {modeNote && <p className="callout">{modeNote}</p>}
      {summaries?.length === 0 && <EmptyState title="No summaries yet">Generate them after the dependency map is complete.</EmptyState>}
      {summaries && summaries.length > 0 && (
        <div className="stack">
          <Tabs label="Summary filter" value={filter} onChange={setFilter} options={FILTERS} />
          <label>
            Directory cluster
            <select value={cluster} onChange={(event) => setCluster(event.target.value)}>
              <option value="all">All modules</option>
              {directories.map((directory) => <option key={directory} value={directory}>{directory}</option>)}
            </select>
          </label>
          {clusterRollup && (
            <div className="card stack">
              <StatusBadge status={clusterRollup.lowest} label={`${clusterRollup.lowest} cluster confidence`} />
              <p>Cluster reading uses the lowest module confidence in {cluster}. {clusterRollup.text.slice(0, 420)}</p>
              <button type="button" onClick={() => void queue(visible.map((item) => item.id))}>Queue this cluster for expert review</button>
            </div>
          )}
          <table>
            <thead><tr><th>Module</th><th>Confidence</th><th>Status</th></tr></thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td><button type="button" className="quiet" aria-pressed={item.id === selectedId} onClick={() => setParams({ summary: item.id })}><span className="path">{item.moduleName}</span></button></td>
                  <td><StatusBadge status={item.confidence} label={item.confidence} /></td>
                  <td><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <EmptyState title="Nothing in this filter">Choose All to see every summary again.</EmptyState>}
        </div>
      )}
      {detail && (
        <Drawer title={detail.moduleName} onClose={() => setParams({})}>
          <IntentSummaryView summary={detail} showRationale />
          <CodeViewer source={source} highlights={highlighted} />
          <h2>Related modules</h2>
          {related.length === 0 && <p>No callers or callees were stored for this module.</p>}
          <ul>{related.map((item) => <li key={item.id} className="path">{item.name}</li>)}</ul>
          <h2>Revision history</h2>
          <ol>
            {(detail.revisions ?? []).map((revision) => (
              <li key={revision.version}>v{revision.version} {revision.action}{revision.reviewerName ? ` by ${revision.reviewerName} (${revision.identityLabel})` : ""} <div>{revision.text}</div></li>
            ))}
          </ol>
          <div className="row">
            <button type="button" onClick={() => void queue([detail.id])}>{detail.queuedForReview ? "Queued for review" : "Send to expert review"}</button>
            <Link className="button secondary" to={`/intent-review/${projectId}`}>Open review queue</Link>
          </div>
        </Drawer>
      )}
    </div>
  );
}
