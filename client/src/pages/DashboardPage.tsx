import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { CountUp } from "../components/CountUp";
import { OpenDemoButton, ResetDemoButton } from "../components/DemoActions";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { motionTokens } from "../motion";
import type { DashboardData, GraphEdge, GraphNode } from "../types";

const STAGES = [
  ["ingestion", "Ingest"],
  ["analysis", "Map"],
  ["summary", "Summarize"],
  ["review", "Validate"],
  ["discrepancy", "Compare"],
] as const;

function reviewStatus(data: DashboardData): string {
  if (!data.statuses || data.statuses.summary !== "complete") return "not_started";
  if (data.validatedByExperts === 0) return "not_started";
  if (data.unreviewed > 0) return "queued";
  return "confirmed";
}

function stageStatus(data: DashboardData, key: (typeof STAGES)[number][0]): string {
  if (!data.statuses) return "not_started";
  if (key === "review") return reviewStatus(data);
  return data.statuses[key];
}

export function DashboardPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);

  function load() {
    const query = projectId ? `?projectId=${projectId}` : "";
    api<DashboardData>(`/api/v1/dashboard${query}`).then(setData).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => {
    setData(null);
    setError("");
    setGraph(null);
    load();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const live = data?.statuses && Object.values(data.statuses).some((status) => status === "running" || status === "queued");
    if (!live) return;
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, [data, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectId || data?.statuses?.analysis !== "complete") return;
    api<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/v1/projects/${projectId}/graph`).then(setGraph).catch(() => setGraph(null));
  }, [projectId, data?.statuses?.analysis]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton lines={6} />;

  const selected = Boolean(data.projectId);
  const metrics = [
    ["Files parsed", data.fileCount - data.flaggedFiles],
    ["Flagged files", data.flaggedFiles],
    ["Modules", data.modulesParsed],
    ["Confirmed edges", data.edgesConfirmed],
    ["Unresolved edges", data.edgesUnresolved],
    ["Summaries", data.intentSummaries],
    ["Validated", data.validatedByExperts],
    ["Discrepancies", data.discrepancies],
  ] as const;

  return (
    <div className="dash">
      <header className="dash-welcome">
        <div>
          <p className="eyebrow">Live</p>
          <h1>{data.projectName ?? "Dashboard"}</h1>
          <p>{selected ? "Every count is a stored row for this project." : "Select a project, or open the demonstration project. Nothing is counted until a project is open."}</p>
          <p className="identity-line">Signed in as {user?.displayName} · {user?.identityLabel}</p>
        </div>
        <div className="row">
          {data.demonstration && <span className="demo-flag">Demonstration data</span>}
          {data.nextAction.to ? <Link className="button" to={data.nextAction.to}>{data.nextAction.label}</Link> : <OpenDemoButton label="Continue" />}
        </div>
      </header>

      <ol className="stage-strip">
        {STAGES.map(([key, label]) => {
          const status = stageStatus(data, key);
          return (
            <li key={key}>
              <StatusBadge status={status} label={label} />
              <span className="muted">{status.replaceAll("_", " ")}</span>
            </li>
          );
        })}
      </ol>

      {!selected && (
        <section className="focus-panel stack">
          <h2>Open the demonstration project</h2>
          <p>One click runs ingest, the dependency map, intent summaries, a confirm from Ada, a correction from Ravi, and discrepancy detection on the bundled sample.</p>
          <OpenDemoButton />
        </section>
      )}

      {selected && (
        <>
          <motion.section className="dash-metrics" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: motionTokens.stagger } } }}>
            {metrics.map(([label, value]) => (
              <motion.article key={label} className="card kpi" variants={{ hidden: { opacity: 0, y: motionTokens.distance }, show: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.base, ease: motionTokens.ease } } }}>
                <span>{label}</span>
                <strong><CountUp to={value} /></strong>
              </motion.article>
            ))}
          </motion.section>

          <div className="dash-main">
            <div className="stack">
              <article className="card stack">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h2>Dependency map</h2>
                  <Link to={`/dependency-map/${data.projectId}`}>Open the full map</Link>
                </div>
                {data.statuses?.analysis !== "complete" && <p>The map appears after dependency analysis completes. {data.statuses?.analysis === "failed" ? data.nextAction.reason : "No edges are drawn before that."}</p>}
                {graph && <GraphPreview nodes={graph.nodes} edges={graph.edges} />}
              </article>
              <article className="card stack">
                <h2>Confidence and review</h2>
                <div className="row">
                  <StatusBadge status="low" label={`${data.confidence.low} low`} />
                  <StatusBadge status="medium" label={`${data.confidence.medium} medium`} />
                  <StatusBadge status="high" label={`${data.confidence.high} high`} />
                </div>
                <p>{data.reviewQueued} queued. {data.validatedByExperts} validated. {data.unreviewed} still inferred. {data.excludedUnreviewed} excluded from compare.</p>
                {data.intentSummaries === 0 && <p>No summaries have been stored.</p>}
              </article>
              <article className="card stack">
                <h2>Discrepancies by impact</h2>
                {data.topDiscrepancies.length === 0 && <p>{data.statuses?.discrepancy === "complete" ? "No discrepancies were stored." : data.nextAction.reason}</p>}
                <ol className="rank-list">
                  {data.topDiscrepancies.map((item) => (
                    <li key={item.id}>
                      <StatusBadge status={item.severity} label={item.severity} />
                      <Link className="path" to={`/discrepancies/${data.projectId}`}>{item.moduleName}</Link>
                      <span>Rank {item.impactRank}. {item.description}</span>
                    </li>
                  ))}
                </ol>
              </article>
            </div>
            <div className="stack">
              <section className="focus-panel stack">
                <h2>Next</h2>
                <p>{data.nextAction.reason}</p>
                {data.nextAction.to ? <Link className="button light" to={data.nextAction.to}>{data.nextAction.label}</Link> : <OpenDemoButton />}
                {data.demonstration && <ResetDemoButton />}
              </section>
              <article className="card stack">
                <h2>Recent activity</h2>
                {data.activity.length === 0 && <p>No ingestion events or intent revisions are stored yet.</p>}
                <ul className="activity-list">
                  {data.activity.map((item) => (
                    <li key={`${item.at}-${item.label}-${item.detail}`}>
                      <span className="mono">{new Date(item.at).toLocaleString()}</span>
                      <span>{item.label.replaceAll("_", " ")}{item.detail ? ` · ${item.detail}` : ""}{item.actor ? ` · ${item.actor}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GraphPreview({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const files = nodes.filter((node) => node.kind === "file").slice(0, 8);
  const fileIds = new Set(files.map((node) => node.id));
  const extra = nodes.filter((node) => node.kind !== "file" && edges.some((edge) => fileIds.has(edge.from) && edge.to === node.id)).slice(0, 4);
  const shown = [...files, ...extra];
  const ids = new Set(shown.map((node) => node.id));
  return (
    <svg className="dash-graph" viewBox="0 0 520 140" role="img" aria-label="Read-only preview of stored modules and edges">
      {edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)).slice(0, 16).map((edge) => {
        const from = shown.findIndex((node) => node.id === edge.from);
        const to = shown.findIndex((node) => node.id === edge.to);
        if (from < 0 || to < 0) return null;
        return <line key={edge.id} x1={36 + from * 48} y1={from % 2 ? 96 : 36} x2={36 + to * 48} y2={to % 2 ? 96 : 36} stroke={edge.resolution === "confirmed" ? "#263b50" : "#7c5e17"} strokeDasharray={edge.resolution === "confirmed" ? undefined : "4 3"} />;
      })}
      {shown.map((node, index) => <circle key={node.id} cx={36 + index * 48} cy={index % 2 ? 96 : 36} r="6" fill={node.resolution === "confirmed" ? "#263b50" : "#7c5e17"} />)}
    </svg>
  );
}
