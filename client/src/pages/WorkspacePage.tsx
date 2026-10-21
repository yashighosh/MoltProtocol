import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Project } from "../types";

export function WorkspacePage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ projects: Project[] }>("/api/v1/projects").then((result) => setProjects(result.projects)).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <p className="callout error" role="alert">{error}</p>;
  if (!projects) return <p aria-live="polite">Loading projects…</p>;

  return (
    <div className="stack">
      <div>
        <h1>Project workspace</h1>
        <p className="lede">Each analysis is one project. Ingestion, the dependency map, intent, review, and discrepancies all use that same identifier.</p>
      </div>
      <Link className="button" to="/ingestion">Start an ingestion</Link>
      {projects.length === 0 && <p className="callout">No project yet. Submit a codebase, or load the bundled sample, from Ingestion.</p>}
      {projects.map((project) => (
        <section key={project.id} className="panel stack">
          <div className="row">
            <h2>{project.name}</h2>
            <span className="mono">{project.id}</span>
          </div>
          <div className="grid-cards">
            <Link className="panel" to={`/ingestion/${project.id}`}>Ingestion <StatusBadge status={project.ingestionStatus} /></Link>
            <Link className="panel" to={`/dependency-map/${project.id}`}>Dependency map <StatusBadge status={project.analysisStatus} /></Link>
            <Link className="panel" to={`/intent-summaries/${project.id}`}>Intent summaries <StatusBadge status={project.summaryStatus} /></Link>
            <Link className="panel" to={`/intent-review/${project.id}`}>Expert review <StatusBadge status={project.reviewQueued ? "queued" : project.reviewValidated ? "confirmed" : "not_started"} label={`${project.reviewValidated} validated`} /></Link>
            <Link className="panel" to={`/discrepancies/${project.id}`}>Discrepancies <StatusBadge status={project.discrepancyStatus} /></Link>
          </div>
        </section>
      ))}
    </div>
  );
}
