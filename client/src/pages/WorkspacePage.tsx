import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { GraphEdge, GraphNode, Project } from "../types";

function MiniMap({ projectId, enabled }: { projectId: string; enabled: boolean }) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  useEffect(() => {
    if (!enabled) return;
    api<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/v1/projects/${projectId}/graph`).then((result) => {
      setNodes(result.nodes.slice(0, 8));
      setEdges(result.edges);
    }).catch(() => undefined);
  }, [projectId, enabled]);
  if (!enabled || nodes.length === 0) return <div className="mini-map" aria-hidden="true" />;
  return (
    <svg className="mini-map" viewBox="0 0 220 92" aria-hidden="true">
      {edges.slice(0, 10).map((edge) => {
        const from = nodes.findIndex((node) => node.id === edge.from);
        const to = nodes.findIndex((node) => node.id === edge.to);
        if (from < 0 || to < 0) return null;
        return <line key={edge.id} x1={20 + from * 24} y1={30} x2={20 + to * 24} y2={62} stroke={edge.resolution === "confirmed" ? "#c9a24a" : "#9b917f"} strokeDasharray={edge.resolution === "confirmed" ? undefined : "3 3"} />;
      })}
      {nodes.map((node, index) => <circle key={node.id} cx={20 + index * 24} cy={index % 2 ? 62 : 28} r="5" fill="#f4eee3" />)}
    </svg>
  );
}

export function WorkspacePage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");

  function load() {
    api<{ projects: Project[] }>("/api/v1/projects").then((result) => setProjects(result.projects)).catch((reason: Error) => setError(reason.message));
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Projects" lede="Each analysis is one project. Ingestion, the dependency map, intent, review, and discrepancies share that identifier." actions={<Link className="button" to="/ingestion">New project</Link>} />
      {error && <ErrorState message={error} onRetry={load} />}
      {!projects && !error && <Skeleton />}
      {projects?.length === 0 && <EmptyState title="No project yet">Submit a codebase, or load the bundled sample, from Ingest.</EmptyState>}
      <div className="grid-cards">
        {projects?.map((project) => {
          const language = project.summary.languages[0]?.language ?? "No parsed language";
          const done = [project.ingestionStatus, project.analysisStatus, project.summaryStatus, project.discrepancyStatus].filter((status) => status === "complete").length;
          return (
            <article key={project.id} className="card stack">
              <MiniMap projectId={project.id} enabled={project.analysisStatus === "complete"} />
              <h2>{project.name}</h2>
              <p>{project.summary.fileCount} files · {language} · {project.summary.rejectedCount} flagged</p>
              <div className="row">
                <StatusBadge status={project.ingestionStatus} label="Ingest" />
                <StatusBadge status={project.analysisStatus} label="Map" />
                <StatusBadge status={project.summaryStatus} label="Intent" />
                <StatusBadge status={project.reviewValidated ? "confirmed" : "not_started"} label="Review" />
                <StatusBadge status={project.discrepancyStatus} label="Compare" />
              </div>
              <div className="meter-track" aria-hidden="true"><span style={{ width: `${(done / 4) * 100}%` }} /></div>
              <Link className="button" to={`/dashboard/${project.id}`}>Open</Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
