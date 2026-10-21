import { Check, Circle, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { ProgressRing } from "../components/ProgressRing";
import { Skeleton } from "../components/Skeleton";
import type { Project } from "../types";

const JOBS = [
  ["ingestionStatus", "Ingestion"],
  ["analysisStatus", "Dependency map"],
  ["summaryStatus", "Intent summaries"],
  ["discrepancyStatus", "Discrepancy detection"],
] as const;

function Mark({ status }: { status: string }) {
  if (status === "complete" || status === "confirmed") return <Check size={16} aria-hidden="true" />;
  if (status === "running" || status === "queued") return <LoaderCircle size={16} aria-hidden="true" />;
  if (status === "failed" || status === "blocked") return <Circle size={16} aria-hidden="true" />;
  return <Circle size={16} aria-hidden="true" />;
}

export function ProgressPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    if (!projectId) return;
    api<Project>(`/api/v1/projects/${projectId}`).then(setProject).catch((reason: Error) => setError(reason.message));
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!projectId) return <EmptyState title="Choose a project">Progress follows one ingested codebase. <Link to="/workspace">Open projects</Link></EmptyState>;

  const complete = project ? JOBS.filter(([key]) => project[key] === "complete").length : 0;

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Progress" lede="The ring and the log follow stored job status. Pending means that stage has not been requested." actions={project?.ingestionStatus === "failed" ? <button type="button" disabled={busy} onClick={() => { setBusy(true); void api(`/api/v1/projects/${projectId}/retry`, { method: "POST" }).finally(() => { setBusy(false); load(); }); }}>Retry ingestion</button> : undefined} />
      {error && <ErrorState message={error} onRetry={load} />}
      {!project && !error && <Skeleton />}
      {project && (
        <div className="grid-2">
          <article className="card"><ProgressRing value={complete / 4} label="Stages marked complete" /></article>
          <ol className="card stack">
            {project.stages.map((stage) => (
              <li key={`${stage.stage}-${stage.createdAt}`} className="row"><Check size={16} aria-hidden="true" /> {stage.stage}{stage.detail ? `: ${stage.detail}` : ""}</li>
            ))}
            {JOBS.map(([key, label]) => (
              <li key={key} className="row"><Mark status={project[key]} /> {label}: {project[key].replaceAll("_", " ")}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
