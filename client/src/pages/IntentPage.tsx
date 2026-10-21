import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { IntentSummaryView } from "../components/IntentSummaryView";
import { StatusBadge } from "../components/StatusBadge";
import type { IntentSummary, Project } from "../types";

export function IntentPage() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [summaries, setSummaries] = useState<IntentSummary[]>([]);
  const [modeNote, setModeNote] = useState("");
  const [cluster, setCluster] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState("");
  const selectedId = params.get("summary");

  function load() {
    if (!projectId) return;
    api<Project>(`/api/v1/projects/${projectId}`).then(setProject).catch((reason: Error) => setError(reason.message));
    api<{ summaries: IntentSummary[]; demonstration: boolean; summaryStatus: string; summaryError: string | null }>(`/api/v1/projects/${projectId}/summaries`).then((result) => {
      setSummaries(result.summaries);
      setModeNote(result.demonstration ? "Demonstration mode is on. Confidence is scored from evidence in the repository, not from a model." : "A live model rewrote the wording. Confidence is still the local evidence score.");
      if (!selectedId && result.summaries[0]) setParams({ summary: result.summaries[0].id });
    }).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => { load(); }, [projectId]);
  const selected = summaries.find((item) => item.id === selectedId) ?? null;
  const directories = [...new Set(summaries.map((item) => item.moduleName.split("/").slice(0, -1).join("/") || "(root)"))];
  const visible = summaries.filter((item) => cluster === "all" || item.moduleName.startsWith(`${cluster}/`) || (cluster === "(root)" && !item.moduleName.includes("/")));
  const clusterRollup = useMemo(() => {
    if (cluster === "all" || visible.length === 0) return null;
    const lowest = visible.some((item) => item.confidence === "low") ? "low" : visible.some((item) => item.confidence === "medium") ? "medium" : "high";
    return { lowest, text: visible.map((item) => `${item.moduleName}: ${item.text}`).join(" ") };
  }, [cluster, visible]);

  useEffect(() => {
    if (!projectId || !selected) return;
    api<{ source: string | null }>(`/api/v1/projects/${projectId}/files/source?path=${encodeURIComponent(selected.moduleName)}`)
      .then((result) => setSource(result.source ?? ""))
      .catch(() => setSource(""));
  }, [projectId, selected?.id]);

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

  if (!projectId) return <p className="callout">Open a project from the workspace first.</p>;

  const highlighted = new Set<number>();
  if (selected) {
    for (const item of selected.evidence) {
      for (let line = item.startLine; line <= item.endLine; line += 1) highlighted.add(line);
    }
  }

  return (
    <div className="stack">
      <div>
        <h1>Business intent summaries</h1>
        <p className="lede">Each summary is inferred. Low confidence stays flagged. Source ranges are the lines the reading actually used.</p>
      </div>
      {error && <p className="callout error" role="alert">{error}</p>}
      {project && project.analysisStatus !== "complete" && <p className="callout">Dependency analysis has not finished. Summaries use those modules. <Link to={`/dependency-map/${projectId}`}>Open the map</Link></p>}
      {project?.analysisStatus === "complete" && summaries.length === 0 && (
        <p className="callout"><button type="button" disabled={busy} onClick={() => void generate()}>{busy ? "Generating…" : "Generate intent summaries"}</button></p>
      )}
      {modeNote && <p className="callout">{modeNote}</p>}
      {summaries.length > 0 && (
        <div className="split map">
          <div className="stack">
            <label>
              Module or directory cluster
              <select value={cluster} onChange={(event) => setCluster(event.target.value)}>
                <option value="all">All modules</option>
                {directories.map((directory) => <option key={directory} value={directory}>{directory}</option>)}
              </select>
            </label>
            {clusterRollup && (
              <div className="panel">
                <StatusBadge status={clusterRollup.lowest} label={`${clusterRollup.lowest} cluster confidence`} />
                <p>Cluster reading uses the lowest module confidence in {cluster}. {clusterRollup.text.slice(0, 420)}</p>
                <button type="button" onClick={() => void queue(visible.map((item) => item.id))}>Queue this cluster for expert review</button>
              </div>
            )}
            <ul className="stack">
              {visible.map((item) => (
                <li key={item.id}>
                  <button type="button" className="secondary" aria-pressed={item.id === selectedId} onClick={() => setParams({ summary: item.id })}>
                    <span className="path">{item.moduleName}</span> <StatusBadge status={item.confidence} label={item.confidence} /> <StatusBadge status={item.status} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {selected && (
            <div className="panel stack">
              <IntentSummaryView summary={selected} />
              <pre className="code">{source.split("\n").map((line, index) => (
                <div key={index} className={highlighted.has(index + 1) ? "hit" : undefined}>{String(index + 1).padStart(3, " ")}  {line}</div>
              ))}</pre>
              <div className="row">
                <button type="button" onClick={() => void queue([selected.id])}>{selected.queuedForReview ? "Queued for review" : "Send to expert review"}</button>
                <Link className="button secondary" to={`/intent-review/${projectId}`}>Open review queue</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
