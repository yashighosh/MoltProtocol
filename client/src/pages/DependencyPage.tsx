import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { GraphCanvas } from "../components/GraphCanvas";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { GraphEdge, GraphNode, Project } from "../types";
import { setTravel, sharedGraphId } from "../travel";

type Detail = {
  module: GraphNode;
  callers: { relationship: string; resolution: string; module?: GraphNode }[];
  callees: { relationship: string; resolution: string; module?: GraphNode }[];
};

function InspectorList({ title, items, mono = false }: { title: string; items: string[]; mono?: boolean }) {
  return (
    <section className="inspector-section">
      <div className="inspector-line">
        <h3>{title}</h3>
        {items.length === 0 && <span className="inspector-empty">—</span>}
      </div>
      {items.length > 0 && <ul>{items.map((item, index) => <li key={`${item}-${index}`} className={mono ? "mono" : undefined}>{item}</li>)}</ul>}
    </section>
  );
}

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
  const location = useLocation();
  const [shared] = useState(() => sharedGraphId() === projectId);
  useEffect(() => {
    const timer = window.setTimeout(() => delete document.documentElement.dataset.sharedGraph, 400);
    return () => window.clearTimeout(timer);
  }, []);
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

  if (!projectId) return <EmptyState title="Select a project">Finish an ingestion first. <Link viewTransition to="/workspace" onClick={() => setTravel(location.pathname, "/workspace")}>Open projects</Link></EmptyState>;

  return (
    <div className="stack reveal-stagger">
      <PageHeader title="Dependency map" lede="Edges come from parsed imports and calls. A missing target stays unresolved. The map does not invent relationships." />
      {error && <ErrorState message={error} />}
      {!project && !error && <Skeleton />}
      {project && project.ingestionStatus !== "complete" && <p className="callout">Ingestion is {project.ingestionStatus}. The map stays unavailable until parsing finishes. <Link viewTransition to={`/ingestion/${projectId}`} onClick={() => setTravel(location.pathname, `/ingestion/${projectId}`)}>Return to ingestion</Link></p>}
      {project?.ingestionStatus === "complete" && project.analysisStatus === "not_started" && (
        <p className="callout">Analysis has not been run. <button type="button" disabled={busy} onClick={() => void analyze()}>{busy ? "Running analysis…" : "Run dependency analysis"}</button></p>
      )}
      {(busy || project?.analysisStatus === "running") && <Skeleton lines={6} />}
      {graph?.message && <p className="callout" role="status">{graph.message}</p>}
      {graph && graph.nodes.length === 0 && project?.analysisStatus === "complete" && <EmptyState title="No modules to draw">Parsing did not produce modules, so there are no edges to invent.</EmptyState>}
      {graph && graph.nodes.length > 0 && (
        <div className="map-layout">
          <GraphCanvas projectId={projectId} nodes={graph.nodes} edges={graph.edges} selectedId={selected} onSelect={(id) => setParams({ module: id })} shared={shared} />
          <aside className="card module-inspector">
            <h2>Selected module</h2>
            {!detail && <p className="muted">Select a node. Callers, callees, and export declarations appear here.</p>}
            {detail && (
              <>
                <p className="path">{detail.module.name}</p>
                <p className="muted">{detail.module.directory || "No directory"} · {detail.module.kind}</p>
                <StatusBadge status={detail.module.resolution} label={detail.module.kind === "file" ? "Parsed module" : detail.module.kind} />
              </>
            )}
            <InspectorList title="Callers" items={detail?.callers.map((item) => `${item.module?.name ?? "Missing module"} · ${item.relationship}`) ?? []} />
            <InspectorList title="Callees" items={detail?.callees.map((item) => `${item.module?.name ?? "Missing module"} · ${item.relationship}`) ?? []} />
            <InspectorList title="Exports" items={exportsFound} mono />
          </aside>
        </div>
      )}
    </div>
  );
}
