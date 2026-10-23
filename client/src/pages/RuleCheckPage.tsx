import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { Discrepancy, IntentSummary } from "../types";

export function RuleCheckPage() {
  const { projectId } = useParams();
  const [summaries, setSummaries] = useState<IntentSummary[] | null>(null);
  const [items, setItems] = useState<Discrepancy[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    api<{ summaries: IntentSummary[] }>(`/api/v1/projects/${projectId}/summaries`).then((result) => setSummaries(result.summaries)).catch((reason: Error) => setError(reason.message));
    api<{ items: Discrepancy[]; discrepancyStatus: string }>(`/api/v1/projects/${projectId}/discrepancies`).then((result) => {
      setItems(result.items);
      setStatus(result.discrepancyStatus);
    }).catch((reason: Error) => setError(reason.message));
  }, [projectId]);

  const rows = useMemo(() => {
    const flagged = new Set(items.map((item) => item.moduleId));
    return (summaries ?? []).map((summary) => {
      const validated = summary.status === "confirmed" || summary.status === "corrected";
      const state = !validated ? "Excluded" : status !== "complete" ? "Not compared" : flagged.has(summary.moduleId) ? "At risk" : "Preserved";
      return { summary, state };
    });
  }, [summaries, items, status]);

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;
  const counts = {
    Preserved: rows.filter((row) => row.state === "Preserved").length,
    "At risk": rows.filter((row) => row.state === "At risk").length,
    Excluded: rows.filter((row) => row.state === "Excluded").length,
    "Not compared": rows.filter((row) => row.state === "Not compared").length,
  };
  const total = counts.Preserved + counts["At risk"] + counts.Excluded;
  const stops = [
    ["var(--success-ink)", counts.Preserved],
    ["var(--danger-ink)", counts["At risk"]],
    ["var(--neutral-ink)", counts.Excluded],
  ] as const;
  let cursor = 0;
  const gradient = total === 0 ? "var(--bg-sunken)" : `conic-gradient(${stops.map(([color, count]) => {
    const start = cursor;
    cursor += (count / total) * 100;
    return `${color} ${start}% ${cursor}%`;
  }).join(", ")})`;

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Rule check" lede="Preserved means a validated intent has no stored discrepancy. At risk means a discrepancy is attached. Unreviewed summaries are excluded. This is not a proof the rule survived a rewrite." />
      {error && <ErrorState message={error} />}
      {summaries === null && !error && <Skeleton />}
      {status && status !== "complete" && <p className="callout" role="status">Detection status is {status.replaceAll("_", " ")}. Validated summaries stay marked not compared until detection completes.</p>}
      {summaries?.length === 0 && <EmptyState title="No intents to check">Generate summaries before grouping them.</EmptyState>}
      {summaries && summaries.length > 0 && (
        <div className="grid-2">
          <article className="card" style={{ display: "grid", placeItems: "center" }}>
            <div className="donut" style={{ background: gradient }} role="img" aria-label={`${counts.Preserved} preserved, ${counts["At risk"]} at risk, ${counts.Excluded} excluded`}>
              <span>{total} intents</span>
            </div>
          </article>
          <ul className="card stack">
            {rows.map((row) => (
              <li key={row.summary.id} className="row" style={{ justifyContent: "space-between" }}>
                <span className="path">{row.summary.moduleName}</span>
                <StatusBadge status={row.state === "Preserved" ? "preserved" : row.state === "At risk" ? "error" : row.state === "Excluded" ? "neutral" : "attention"} label={row.state} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
