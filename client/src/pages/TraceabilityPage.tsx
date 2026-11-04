import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { DataTable, type Column } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterBar, useFilterParams } from "../components/FilterBar";
import { PageHeader } from "../components/PageHeader";
import { PendingData } from "../components/PendingData";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { Tabs } from "../components/Tabs";
import { TraceChain } from "../components/TraceChain";
import { useToast } from "../components/Toast";
import type { RuleRow } from "../connection/contracts";
import { getRuleTrace, listComplianceRules, recordDecision } from "../connection/modernize";
import { useLoad } from "../hooks/useLoad";
import type { TraceRow } from "../types";

const STATUSES = [
  { id: "all", label: "All" },
  { id: "preserved", label: "Preserved" },
  { id: "modified", label: "Modified" },
  { id: "removed", label: "Removed" },
  { id: "unassessed", label: "Unassessed" },
];

export function TraceabilityPage() {
  const { projectId, ruleId } = useParams();
  const [tab, setTab] = useState(ruleId ? "rules" : "rules");
  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;
  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Compliance and traceability" lede="Each accepted rule can be traced to its legacy source, interpreted intent, architecture coverage, and migration status. Source ranges remain available as a second view." />
      <Tabs label="Traceability views" value={tab} onChange={setTab} options={[{ id: "rules", label: "Rules" }, { id: "sources", label: "Source ranges" }]} />
      {tab === "sources" ? <SourceRanges projectId={projectId} /> : <RulesLedger projectId={projectId} ruleId={ruleId} />}
    </div>
  );
}

function RulesLedger({ projectId, ruleId }: { projectId: string; ruleId?: string }) {
  const { params, setFilter } = useFilterParams();
  const status = params.get("status") ?? "all";
  const q = params.get("q") ?? "";
  const rules = useLoad(() => listComplianceRules(projectId, { status: status === "all" ? undefined : status, q: q || undefined }), [projectId, status, q]);
  const trace = useLoad(() => (ruleId ? getRuleTrace(projectId, ruleId) : Promise.resolve(null)), [projectId, ruleId]);
  const toast = useToast();
  const [decision, setDecision] = useState("preserved");
  const [justification, setJustification] = useState("");
  const [formError, setFormError] = useState("");

  const columns: Column<RuleRow>[] = [
    { id: "key", header: "Rule", render: (row) => <Link className="mono" to={`/traceability/${projectId}/${row.id}?${params.toString()}`}>{row.ruleKey}</Link> },
    { id: "statement", header: "Statement", render: (row) => row.statement },
    { id: "source", header: "Source", render: (row) => row.moduleName ?? "Not linked" },
    { id: "status", header: "Status", render: (row) => <StatusBadge status={row.status === "unassessed" ? "attention" : row.status} label={row.status} /> },
  ];

  async function submit() {
    if (!ruleId) return;
    if ((decision === "modified" || decision === "removed") && justification.trim().length < 20) {
      setFormError("Modified or Removed needs a written justification of at least 20 characters.");
      return;
    }
    setFormError("");
    try {
      await recordDecision(projectId, ruleId, { status: decision, justification: justification.trim() || undefined });
      toast("Decision recorded.");
      trace.reload();
      rules.reload();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "The decision was not saved.");
    }
  }

  return (
    <div className="stack">
      <FilterBar
        label="Rules"
        segments={STATUSES}
        segment={status}
        onSegment={(id) => setFilter("status", id)}
        search={q}
        onSearch={(value) => setFilter("q", value)}
      />
      <p className="muted">Filters stay in the page address, so a report can be reopened with the same narrowing.</p>
      {rules.state.kind === "loading" && <Skeleton lines={5} />}
      {rules.state.kind === "error" && <ErrorState message={rules.state.message} onRetry={rules.reload} />}
      {rules.state.kind === "disconnected" && <PendingData title="No compliance ledger yet" />}
      {rules.state.kind === "ready" && (
        <DataTable caption="Business rules" columns={columns} rows={rules.state.data.items} empty="No accepted rules match this filter." />
      )}
      {ruleId && trace.state.kind === "loading" && <Skeleton />}
      {ruleId && trace.state.kind === "disconnected" && <PendingData title="This rule trace is not available yet" />}
      {ruleId && trace.state.kind === "error" && <ErrorState message={trace.state.message} onRetry={trace.reload} />}
      {trace.state.kind === "ready" && trace.state.data && (
        <div className="stack">
          <TraceChain stages={{
            "Legacy source": <p>{trace.state.data.legacy.path ?? "No file stored"} {trace.state.data.legacy.lines ?? ""} {trace.state.data.legacy.drifted ? "Source has drifted." : ""}</p>,
            Intent: <p>{trace.state.data.intent.text ?? "No intent stored"} {trace.state.data.intent.reviewer ? `Reviewed by ${trace.state.data.intent.reviewer}.` : ""}</p>,
            Architecture: <p>{trace.state.data.architecture.componentName ?? "No covering component"} {trace.state.data.architecture.stale ? "Coverage is stale." : ""}</p>,
            Status: <p>{trace.state.data.migration.status}. {trace.state.data.migration.justification ?? "No justification stored."} {trace.state.data.migration.versionNote ?? ""}</p>,
          }} />
          {trace.state.data.suggestion && <p className="callout">Suggestion only: {trace.state.data.suggestion}. It is not applied automatically.</p>}
          <form className="card stack" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <h2>Migration decision</h2>
            <label>
              Status
              <select value={decision} onChange={(event) => setDecision(event.target.value)}>
                <option value="preserved">Preserved</option>
                <option value="modified">Modified</option>
                <option value="removed">Removed</option>
              </select>
            </label>
            {(decision === "modified" || decision === "removed") && (
              <label>
                Justification ({justification.trim().length} characters)
                <textarea value={justification} onChange={(event) => setJustification(event.target.value)} aria-describedby="justification-help" />
              </label>
            )}
            <p id="justification-help" className="muted">Modified and Removed need a documented justification before they can be saved.</p>
            {formError && <p role="alert">{formError}</p>}
            <button type="submit" disabled={(decision === "modified" || decision === "removed") && justification.trim().length < 20}>
              Record decision
            </button>
          </form>
          <h2>Decision history</h2>
          <ol>
            {trace.state.data.history.length === 0 && <li>No decision recorded.</li>}
            {trace.state.data.history.map((item) => (
              <li key={item.id}>{item.status} by {item.decidedBy ?? "unknown"} {item.decidedAt ?? ""}. {item.justification ?? ""}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function SourceRanges({ projectId }: { projectId: string }) {
  const rows = useLoad(() => api<{ rows: TraceRow[] }>(`/api/v1/projects/${projectId}/traceability`).then((result) => result.rows), [projectId]);
  if (rows.state.kind === "loading") return <Skeleton />;
  if (rows.state.kind === "error" || rows.state.kind === "disconnected") return <ErrorState message={rows.state.kind === "error" ? rows.state.message : "Source ranges could not be loaded."} onRetry={rows.reload} />;
  if (rows.state.data.length === 0) return <EmptyState title="No files to trace">Ingest a codebase before expecting a matrix.</EmptyState>;
  return (
    <div className="table-scroll">
      <table>
        <caption className="visually-hidden">Source ranges</caption>
        <thead><tr><th>Source</th><th>Lines</th><th>Intent</th><th>Review</th><th>Reviewer</th><th>Discrepancy</th></tr></thead>
        <tbody>
          {rows.state.data.map((row) => (
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
  );
}
