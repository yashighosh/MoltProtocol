import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { GraphCanvas } from "../components/GraphCanvas";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { GraphEdge, GraphNode, Project } from "../types";

type Detail = {
  module: GraphNode;
  callers: { relationship: string; resolution: string; module?: GraphNode }[];
  callees: { relationship: string; resolution: string; module?: GraphNode }[];
};

function exportNames(source: string) {
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_]+)/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  return [...names];
}

export function DependencyPage() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [graph, setGraph] = useState<{ analysisStatus: string; message: string; nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [exportsFound, setExportsFound] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = params.get("module");

  function load() {
    if (!projectId) return;
    api<Project>(`/api/v1/projects/${projectId}`).then(setProject).catch((reason: Error) => setError(reason.message));
    api<typeof graph>(`/api/v1/projects/${projectId}/graph`).then((result) => setGraph(result)).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectId || !selected) {
      setDetail(null);
      return;
    }
    api<Detail>(`/api/v1/projects/${projectId}/modules/${selected}`).then((result) => {
      setDetail(result);
      if (result.module.kind !== "file") {
        setExportsFound([]);
        return;
      }
      api<{ source: string | null }>(`/api/v1/projects/${projectId}/files/source?path=${encodeURIComponent(result.module.name)}`)
        .then((file) => setExportsFound(exportNames(file.source ?? "")))
        .catch(() => setExportsFound([]));
    }).catch((reason: Error) => setError(reason.message));
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

  if (!projectId) return <EmptyState title="Select a project">Finish an ingestion first. <Link to="/workspace">Open projects</Link></EmptyState>;

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Dependency map" lede="Edges come from parsed imports and calls. A missing target stays unresolved. The map does not invent relationships." />
      {error && <ErrorState message={error} />}
      {!project && !error && <Skeleton />}
      {project && project.ingestionStatus !== "complete" && <p className="callout">Ingestion is {project.ingestionStatus}. The map stays unavailable until parsing finishes. <Link to={`/ingestion/${projectId}`}>Return to ingestion</Link></p>}
      {project?.ingestionStatus === "complete" && project.analysisStatus === "not_started" && (
        <p className="callout">Analysis has not been run. <button type="button" disabled={busy} onClick={() => void analyze()}>{busy ? "Running analysis…" : "Run dependency analysis"}</button></p>
      )}
      {graph?.message && <p className="callout" role="status">{graph.message}</p>}
      {graph && graph.nodes.length === 0 && project?.analysisStatus === "complete" && <EmptyState title="No modules to draw">Parsing did not produce modules, so there are no edges to invent.</EmptyState>}
      {graph && graph.nodes.length > 0 && (
        <div className="split map">
          <GraphCanvas projectId={projectId} nodes={graph.nodes} edges={graph.edges} selectedId={selected} onSelect={(id) => setParams({ module: id })} />
          <aside className="card stack">
            <h2>Selected module</h2>
            {!detail && <p>Select a node. Callers, callees, and export declarations appear here.</p>}
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
                <h2>Exports</h2>
                {exportsFound.length === 0 && <p>No export declarations in this file.</p>}
                <ul>{exportsFound.map((name) => <li key={name} className="mono">{name}</li>)}</ul>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
