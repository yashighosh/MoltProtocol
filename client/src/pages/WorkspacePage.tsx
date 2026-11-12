import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api";
import { ResetDemoButton } from "../components/DemoActions";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import type { GraphEdge, GraphNode, Project } from "../types";
import { armSharedGraph, setTravel } from "../travel";

function MiniMap({ projectId, enabled, shared }: { projectId: string; enabled: boolean; shared: boolean }) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  useEffect(() => {
    if (!enabled) return;
    api<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/v1/projects/${projectId}/graph`).then((result) => {
      setNodes(result.nodes.slice(0, 8));
      setEdges(result.edges);
    }).catch(() => undefined);
  }, [projectId, enabled]);
  const shareStyle = shared ? { viewTransitionName: "project-graph" } : undefined;
  if (!enabled || nodes.length === 0) return <div className="mini-map" style={shareStyle} aria-hidden="true" />;
  return (
    <svg className="mini-map" style={shareStyle} viewBox="0 0 220 92" aria-hidden="true">
      {edges.slice(0, 10).map((edge) => {
        const from = nodes.findIndex((node) => node.id === edge.from);
        const to = nodes.findIndex((node) => node.id === edge.to);
        if (from < 0 || to < 0) return null;
        return <line key={edge.id} x1={20 + from * 24} y1={30} x2={20 + to * 24} y2={62} stroke={edge.resolution === "confirmed" ? "var(--gold)" : "var(--night-text-muted)"} strokeDasharray={edge.resolution === "confirmed" ? undefined : "3 3"} />;
      })}
      {nodes.map((node, index) => <circle key={node.id} cx={20 + index * 24} cy={index % 2 ? 62 : 28} r="5" fill="var(--night-text)" />)}
    </svg>
  );
}

export function WorkspacePage() {
  const location = useLocation();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [sharedId, setSharedId] = useState("");

  function load() {
    api<{ projects: Project[] }>("/api/v1/projects").then((result) => setProjects(result.projects)).catch((reason: Error) => setError(reason.message));
  }
  useEffect(() => { load(); }, []);

  const filesAnalysed = projects?.reduce((sum, project) => sum + project.summary.fileCount, 0) ?? 0;
  const flagged = projects?.reduce((sum, project) => sum + project.summary.rejectedCount, 0) ?? 0;

  return (
    <div className="stack reveal-stagger">
      <PageHeader
        title="Projects"
        lede="Each analysis is one project. Ingestion, the dependency map, intent, review and discrepancies share that identifier."
        actions={<Link viewTransition className="button" to="/ingestion" onClick={() => setTravel(location.pathname, "/ingestion")}>New project</Link>}
      />
      {error && <ErrorState message={error} onRetry={load} />}
      {!projects && !error && <Skeleton />}
      {projects && (
        <div className="project-stats">
          <article className="card kpi"><strong>{projects.length}</strong><span>Projects</span></article>
          <article className="card kpi"><strong>{filesAnalysed}</strong><span>Files analysed</span></article>
          <article className="card kpi"><strong>{flagged}</strong><span>Flagged</span></article>
        </div>
      )}
      {projects?.length === 0 && <EmptyState title="No project yet">Submit a codebase from Ingest to start a project.</EmptyState>}
      <div className="project-grid">
        {projects?.map((project) => {
          const language = project.summary.languages[0]?.language ?? "No parsed language";
          const stages = [
            { label: "Ingest", done: project.ingestionStatus === "complete" },
            { label: "Map", done: project.analysisStatus === "complete" },
            { label: "Intent", done: project.summaryStatus === "complete" },
            { label: "Review", done: project.reviewValidated > 0 },
            { label: "Compare", done: project.discrepancyStatus === "complete" },
          ];
          const done = stages.filter((stage) => stage.done).length;
          return (
            <article key={project.id} className="card project-card" tabIndex={0}>
              <Link
                viewTransition
                className="mini-map-link"
                to={`/dependency-map/${project.id}`}
                aria-label={`Open the dependency map for ${project.name}`}
                onPointerDown={() => setSharedId(project.id)}
                onClick={() => { armSharedGraph(project.id); setTravel(location.pathname, `/dependency-map/${project.id}`); }}
              >
                <MiniMap projectId={project.id} enabled={project.analysisStatus === "complete"} shared={sharedId === project.id} />
              </Link>
              <div className="stack project-body">
                <div className="project-title">
                  <h2>{project.name}</h2>
                  {project.demonstration && <span className="demo-flag">Demonstration data</span>}
                </div>
                <p className="project-meta">{project.summary.fileCount} files · {language} · {project.summary.rejectedCount} flagged</p>
                <div className="stage-row">
                  {stages.map((stage) => (
                    <span key={stage.label} className={stage.done ? "done" : ""}>
                      <i className="stage-check" />
                      {stage.label}
                    </span>
                  ))}
                </div>
                <div className="stage-bar" aria-hidden="true"><span style={{ width: `${(done / stages.length) * 100}%` }} /></div>
                <p className="muted">{done} of {stages.length} stages complete{project.discrepancyStatus === "blocked" ? ". Compare needs attention" : ""}.</p>
                <div className="row">
                  <Link viewTransition className="button" to={`/dashboard/${project.id}`} onClick={() => setTravel(location.pathname, `/dashboard/${project.id}`)}>Open</Link>
                  {project.demonstration && <ResetDemoButton onReset={load} />}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
