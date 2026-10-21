import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { ProgressRing } from "../components/ProgressRing";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { DashboardData } from "../types";

export function DashboardPage() {
  const { projectId } = useParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  function load() {
    const query = projectId ? `?projectId=${projectId}` : "";
    api<DashboardData>(`/api/v1/dashboard${query}`).then(setData).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => { setData(null); setError(""); load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalConfidence = data ? data.confidence.low + data.confidence.medium + data.confidence.high : 0;

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title={data?.projectName ?? "Dashboard"} lede="Counts come from the stored project. A low-confidence summary or a drifted source is at risk." actions={<Link className="button" to="/ingestion">New project</Link>} />
      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <Skeleton lines={5} />}
      {data && data.modulesParsed === 0 && data.intentSummaries === 0 && (
        <EmptyState title="No parsed modules yet">Open a project from Projects, or load the bundled sample from Ingest.</EmptyState>
      )}
      {data && (data.modulesParsed > 0 || data.intentSummaries > 0) && (
        <>
          <div className="grid-2">
            <article className="card row" style={{ alignItems: "center" }}>
              {data.stageProgress == null ? <p>Open a project to see its stage progress.</p> : <ProgressRing value={data.stageProgress} label="Completed analysis stages" />}
              <div className="stack">
                <h2>Stage progress</h2>
                {data.statuses && (
                  <div className="row">
                    <StatusBadge status={data.statuses.ingestion} label={`Ingest ${data.statuses.ingestion}`} />
                    <StatusBadge status={data.statuses.analysis} label={`Map ${data.statuses.analysis}`} />
                    <StatusBadge status={data.statuses.summary} label={`Intent ${data.statuses.summary}`} />
                    <StatusBadge status={data.statuses.discrepancy} label={`Compare ${data.statuses.discrepancy}`} />
                  </div>
                )}
              </div>
            </article>
            <div className="grid-cards">
              <article className="card kpi"><span>Modules parsed</span><strong>{data.modulesParsed}</strong></article>
              <article className="card kpi"><span>Intent summaries</span><strong>{data.intentSummaries}</strong></article>
              <article className="card kpi"><span>Validated by experts</span><strong>{data.validatedByExperts}</strong></article>
              <article className="card kpi"><span>At risk</span><strong>{data.atRisk}</strong></article>
              <article className="card kpi"><span>Discrepancies</span><strong>{data.discrepancies}</strong></article>
            </div>
          </div>
          <div className="grid-2">
            <article className="card stack">
              <h2>Confidence</h2>
              {totalConfidence === 0 && <p>No summaries have been generated.</p>}
              {(["high", "medium", "low"] as const).map((level) => (
                <div className="bar-row" key={level}>
                  <span>{level}</span>
                  <i aria-hidden="true"><span style={{ width: `${totalConfidence ? (data.confidence[level] / totalConfidence) * 100 : 0}%` }} /></i>
                  <span className="mono">{data.confidence[level]}</span>
                </div>
              ))}
            </article>
            <article className="card stack">
              <h2>Clusters</h2>
              {data.clusters.length === 0 && <p>No directories yet.</p>}
              {data.clusters.map((cluster) => (
                <div className="row" key={cluster.directory} style={{ justifyContent: "space-between" }}>
                  <span className="path">{cluster.directory || "(root)"}</span>
                  <span>{cluster.modules} modules{cluster.low > 0 ? `, ${cluster.low} low confidence` : ""}</span>
                </div>
              ))}
            </article>
          </div>
          <article className="card stack">
            <h2>Recent activity</h2>
            {data.activity.length === 0 && <p>No stages or revisions recorded.</p>}
            <ul>{data.activity.map((item) => <li key={`${item.at}-${item.label}-${item.detail}`}><span className="mono">{new Date(item.at).toLocaleString()}</span> {item.label}{item.detail ? `: ${item.detail}` : ""}</li>)}</ul>
          </article>
        </>
      )}
    </div>
  );
}
