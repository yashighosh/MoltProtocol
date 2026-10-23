import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { TraceRow } from "../types";

export function TraceabilityPage() {
  const { projectId } = useParams();
  const [rows, setRows] = useState<TraceRow[] | null>(null);
  const [error, setError] = useState("");
  function load() {
    if (!projectId) return;
    api<{ rows: TraceRow[] }>(`/api/v1/projects/${projectId}/traceability`).then((result) => setRows(result.rows)).catch((reason: Error) => setError(reason.message));
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;
  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Traceability" lede="Each row joins a source range to the intent, the review, and any discrepancy stored for that module." />
      {error && <ErrorState message={error} onRetry={load} />}
      {rows === null && !error && <Skeleton />}
      {rows?.length === 0 && <EmptyState title="No files to trace">Ingest a codebase before expecting a matrix.</EmptyState>}
      {rows && rows.length > 0 && (
        <div style={{ overflow: "auto" }}>
          <table>
            <thead><tr><th>Source</th><th>Lines</th><th>Intent</th><th>Review</th><th>Reviewer</th><th>Discrepancy</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.path}-${row.startLine}-${row.summaryId}`}>
                  <td className="path">{row.path}</td>
                  <td className="mono">{row.startLine == null ? "n/a" : `${row.startLine}-${row.endLine}`}</td>
                  <td>{row.intentText ?? row.note ?? "No intent stored"}</td>
                  <td><StatusBadge status={row.reviewStatus} /></td>
                  <td>{row.reviewerName ? `${row.reviewerName} (${row.identityLabel})` : "None"}</td>
                  <td>{row.discrepancy ?? "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
