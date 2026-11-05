import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { CountUp } from "../components/CountUp";
import { OpenDemoButton } from "../components/DemoActions";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { DashboardData } from "../types";

const STAGES = [
  ["ingestion", "Ingest"],
  ["analysis", "Map"],
  ["summary", "Summarize"],
  ["review", "Validate"],
  ["discrepancy", "Compare"],
] as const;

export function reviewStage(data: Pick<DashboardData, "statuses" | "validatedByExperts" | "unreviewed" | "reviewQueued">): { status: string; detail: string } {
  if (!data.statuses || data.statuses.summary !== "complete") {
    return { status: "not_started", detail: "Summaries have not been generated." };
  }
  if (data.reviewQueued > 0) {
    return { status: "queued", detail: `${data.reviewQueued} waiting in expert review.` };
  }
  if (data.validatedByExperts > 0 && data.unreviewed > 0) {
    return { status: "attention", detail: `${data.validatedByExperts} validated. ${data.unreviewed} still inferred and not queued.` };
  }
  if (data.validatedByExperts > 0) return { status: "confirmed", detail: `${data.validatedByExperts} validated.` };
  return { status: "not_started", detail: "No summary has been confirmed." };
}

function stageStatus(data: DashboardData, key: (typeof STAGES)[number][0]): string {
  if (!data.statuses) return "not_started";
  if (key === "review") return reviewStage(data).status;
  return data.statuses[key];
}

function stageDetail(data: DashboardData, key: (typeof STAGES)[number][0]): string {
  if (key === "review") return reviewStage(data).detail;
  if (key === "discrepancy" && data.statuses?.discrepancy === "blocked" && data.validatedByExperts > 0) {
    return "The last compare ran before this validation. Run discrepancy detection again.";
  }
  const status = data.statuses?.[key] ?? "not_started";
  return status.replaceAll("_", " ");
}

function compareReason(data: DashboardData): string {
  if (data.statuses?.discrepancy === "blocked" && data.validatedByExperts > 0) {
    return "Compare is still blocked from the earlier run, which found no confirmed summary. Validated summaries exist now. Run discrepancy detection again.";
  }
  if (data.statuses?.discrepancy === "complete") return "No discrepancies were stored.";
  return data.nextAction.reason;
}

function stamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function DashboardPage() {
  const { projectId } = useParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  function load() {
    const query = projectId ? `?projectId=${projectId}` : "";
    api<DashboardData>(`/api/v1/dashboard${query}`).then(setData).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => {
    setData(null);
    setError("");
    load();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const live = data?.statuses && Object.values(data.statuses).some((status) => status === "running" || status === "queued");
    if (!live) return;
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, [data, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const confidenceTotal = data.confidence.low + data.confidence.medium + data.confidence.high;
  const activity = data.activity.reduce<DashboardData["activity"]>((groups, item) => {
    const previous = groups[groups.length - 1];
    const sameSecond = previous && previous.label === item.label && previous.at.slice(0, 19) === item.at.slice(0, 19);
    if (previous && sameSecond) {
      const count = Number(previous.detail?.match(/^(\d+) /)?.[1] ?? 1) + 1;
      previous.detail = `${count} ${item.label.replaceAll("_", " ")}`;
      return groups;
    }
    groups.push({ ...item });
    return groups;
  }, []).slice(0, 8);

  return (
    <div className="board">
      <section className="board-panel">
        <p className="board-kicker">Project</p>
        <div className="board-path">
          <div>
            <h1>{data.projectName ?? "No project open"}</h1>
            <p className="muted">{selected ? "Every count is a stored row for this project." : "Nothing is counted until a project is open."}</p>
          </div>
          <div className="row">
            {data.demonstration && <span className="demo-flag">Demonstration</span>}
            {data.nextAction.to ? <Link className="button" to={data.nextAction.to}>{data.nextAction.label}</Link> : <OpenDemoButton />}
          </div>
        </div>
        {selected && data.projectId && <p className="board-id mono">{data.projectId}</p>}
        {selected ? (
          <div className="stat-grid">
            {metrics.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong className={((label === "Flagged files" || label === "Unresolved edges" || label === "Discrepancies") && value > 0) ? "warn" : undefined}><CountUp to={value} /></strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Open the demonstration project to load the bundled sample. Ingest, the map, summaries, a confirm, a correction, and discrepancy detection run from that record.</p>
        )}
      </section>

      <section className="board-panel">
        <p className="board-kicker">Workflow</p>
        <ol className="flow">
          {STAGES.map(([key, label], index) => (
            <li key={key}>
              <span className="flow-step">{String(index + 1).padStart(2, "0")}</span>
              <strong>{label}</strong>
              <StatusBadge status={stageStatus(data, key)} />
              <span className="muted">{stageDetail(data, key)}</span>
            </li>
          ))}
        </ol>
      </section>

      {selected && (
        <div className="board-work">
          <div className="stack">
            <section className="board-panel">
              <div className="board-path">
                <p className="board-kicker">Confidence</p>
                <Link to={`/dependency-map/${data.projectId}`}>Open the map</Link>
              </div>
              {confidenceTotal === 0 ? (
                <p className="muted">No confidence counts are stored yet.</p>
              ) : (
                <>
                  <div className="meter-bar" role="img" aria-label={`${data.confidence.high} high, ${data.confidence.medium} medium, ${data.confidence.low} low`}>
                    {data.confidence.high > 0 && <span className="meter-high" style={{ flexGrow: data.confidence.high }} />}
                    {data.confidence.medium > 0 && <span className="meter-med" style={{ flexGrow: data.confidence.medium }} />}
                    {data.confidence.low > 0 && <span className="meter-low" style={{ flexGrow: data.confidence.low }} />}
                  </div>
                  <p className="muted">Confidence bands, not validation state. High {data.confidence.high} ({Math.round((data.confidence.high / confidenceTotal) * 100)}%). Medium {data.confidence.medium} ({Math.round((data.confidence.medium / confidenceTotal) * 100)}%). Low {data.confidence.low} ({Math.round((data.confidence.low / confidenceTotal) * 100)}%).</p>
                </>
              )}
              <p className="muted">{data.reviewQueued} queued. {data.validatedByExperts} validated. {data.unreviewed} still inferred. {data.excludedUnreviewed} excluded from compare.</p>
            </section>
            <section className="board-panel">
              <div className="board-path">
                <p className="board-kicker">Discrepancies</p>
                <Link to={`/discrepancies/${data.projectId}`}>Open the list</Link>
              </div>
              {data.topDiscrepancies.length === 0 && <p className="muted">{compareReason(data)} {data.validatedByExperts === 0 && <Link to={`/intent-review/${data.projectId}`}>Open expert review</Link>}</p>}
              <ol className="event-list">
                {data.topDiscrepancies.map((item) => (
                  <li key={item.id}>
                    <StatusBadge status={item.severity} />
                    <div>
                      <Link className="path" to={`/discrepancies/${data.projectId}`}>{item.moduleName}</Link>
                      <p className="muted">Rank {item.impactRank}. {item.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <section className="board-panel">
            <p className="board-kicker">Activity</p>
            {activity.length === 0 && <p className="muted">No ingestion events or intent revisions are stored yet.</p>}
            <ol className="event-list">
              {activity.map((item) => (
                <li key={`${item.at}-${item.label}-${item.detail}`}>
                  <span className="mono">{stamp(item.at)}</span>
                  <p>{item.label.replaceAll("_", " ")}{item.detail ? ` · ${item.detail}` : ""}{item.actor ? ` · ${item.actor}` : ""}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
