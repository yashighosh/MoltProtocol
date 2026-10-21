import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { GraphCanvas } from "../components/GraphCanvas";
import { StatusBadge } from "../components/StatusBadge";
import type { GraphEdge, GraphNode, Project } from "../types";

type Detail = {
  module: GraphNode;
  callers: { relationship: string; resolution: string; module?: GraphNode }[];
  callees: { relationship: string; resolution: string; module?: GraphNode }[];
};

export function DependencyPage() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [graph, setGraph] = useState<{ analysisStatus: string; message: string; nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = params.get("module");

  function load() {
    if (!projectId) return;
    api<Project>(`/api/v1/projects/${projectId}`).then(setProject).catch((reason: Error) => setError(reason.message));
    api<typeof graph>(`/api/v1/projects/${projectId}/graph`).then((result) => setGraph(result)).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => { load(); }, [projectId]);

  useEffect(() => {
    if (!projectId || !selected) {
      setDetail(null);
      return;
    }
    api<Detail>(`/api/v1/projects/${projectId}/modules/${selected}`).then(setDetail).catch((reason: Error) => setError(reason.message));
  }, [projectId, selected]);

  async function analyze() {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/projects/${projectId}/dependency-analysis`, { method: "POST" });
      const started = Date.now();
      const timer = window.setInterval(() => {
        api<Project>(`/api/v1/projects/${projectId}`).then((result) => {
          setProject(result);
          if (result.analysisStatus === "complete" || result.analysisStatus === "failed" || Date.now() - started > 20000) {
            window.clearInterval(timer);
            load();
            setBusy(false);
          }
        });
      }, 600);
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof ApiError ? reason.message : "Analysis failed to start.");
    }
  }

  if (!projectId) return <p className="callout">Select a project from the workspace, or finish an ingestion first. <Link to="/workspace">Open workspace</Link></p>;

  return (
    <div className="stack">
      <div>
        <h1>Dependency and structure map</h1>
        <p className="lede">Edges come from parsed imports and calls. A missing target stays unresolved. The map does not invent relationships to look fuller.</p>
      </div>
      {error && <p className="callout error" role="alert">{error}</p>}
      {project && project.ingestionStatus !== "complete" && <p className="callout">Ingestion is {project.ingestionStatus}. The map stays unavailable until parsing finishes. <Link to={`/ingestion/${projectId}`}>Return to ingestion</Link></p>}
      {project?.ingestionStatus === "complete" && project.analysisStatus === "not_started" && (
        <p className="callout">Analysis has not been run. <button type="button" disabled={busy} onClick={() => void analyze()}>{busy ? "Running analysis…" : "Run dependency analysis"}</button></p>
      )}
      {graph?.message && <p className="callout" role="status">{graph.message}</p>}
      {graph && graph.nodes.length > 0 && (
        <div className="stack">
          <GraphCanvas projectId={projectId} nodes={graph.nodes} edges={graph.edges} selectedId={selected} onSelect={(id) => setParams({ module: id })} />
          <aside className="panel stack">
            <h2>Selected module</h2>
            {!detail && <p>Select a node. Callers and callees appear here.</p>}
            {detail && (
              <>
                <p className="path">{detail.module.name}</p>
                <StatusBadge status={detail.module.resolution} label={detail.module.kind === "file" ? "Parsed module" : detail.module.kind} />
                <h2>Callers</h2>
                {detail.callers.length === 0 && <p>No callers inside this ingest.</p>}
                <ul>{detail.callers.map((item, index) => <li key={index}>{item.module?.name} · {item.relationship} · {item.resolution}</li>)}</ul>
                <h2>Callees</h2>
                {detail.callees.length === 0 && <p>No callees inside this ingest.</p>}
                <ul>{detail.callees.map((item, index) => <li key={index}>{item.module?.name} · {item.relationship} · {item.resolution}</li>)}</ul>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
