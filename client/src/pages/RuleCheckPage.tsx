import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CoverageBar } from "../components/CoverageBar";
import { DataTable, type Column } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { PendingData } from "../components/PendingData";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { CoverageRow } from "../connection/contracts";
import { getRuleCheck, listRuleChecks } from "../connection/modernize";
import { useLoad } from "../hooks/useLoad";

const ORDER = ["dropped", "distorted", "mentioned_only", "retired_by_design", "not_in_scope", "preserved"];

function tone(status: string) {
  if (status === "preserved") return "preserved";
  if (status === "dropped") return "error";
  if (status === "distorted" || status === "mentioned_only") return "attention";
  return "neutral";
}

export function RuleCheckPage() {
  const { projectId, runId } = useParams();
  const navigate = useNavigate();
  const checks = useLoad(() => listRuleChecks(projectId!), [projectId]);
  const activeId = runId ?? (checks.state.kind === "ready" ? checks.state.data.items[0]?.id : undefined);
  const check = useLoad(activeId ? () => getRuleCheck(projectId!, activeId) : null, [projectId, activeId]);
  const [selected, setSelected] = useState<string | null>(null);

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;

  const data = check.state.kind === "ready" ? check.state.data : null;
  const rows = [...(data?.rows ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const current = rows.find((row) => row.id === selected) ?? null;
  const columns: Column<CoverageRow>[] = [
    { id: "rule", header: "Rule", render: (row) => <span className="mono">{row.ruleKey}</span> },
    { id: "statement", header: "Statement", render: (row) => row.statement },
    { id: "status", header: "Coverage", render: (row) => <StatusBadge status={tone(row.status)} label={row.status.replaceAll("_", " ")} /> },
    { id: "component", header: "Component", render: (row) => row.componentName ?? "None" },
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Demonstration"
        title="Rule preservation"
        lede="Preserved means a component explicitly carries this rule and an architect affirmed it. A rule only mentioned in a description is not counted as preserved. This is a static comparison. It does not prove runtime behavior."
      />
      {checks.state.kind === "ready" && checks.state.data.items.some((item) => item.id === "billing-demo-check") && (
        <p className="callout" role="status">Demonstration for Legacy Billing. Preserved, distorted, and dropped follow the sample's billing rules and the findings already stored for this project.</p>
      )}
      {checks.state.kind === "loading" && <Skeleton lines={5} />}
      {checks.state.kind === "error" && <ErrorState message={checks.state.message} onRetry={checks.reload} />}
      {checks.state.kind === "disconnected" && <PendingData title="No rule check is stored yet" />}
      {checks.state.kind === "ready" && checks.state.data.items.length === 0 && (
        <EmptyState title="No rule check yet">Run a check after a target architecture and accepted rules are stored.</EmptyState>
      )}
      {checks.state.kind === "ready" && checks.state.data.items.length > 0 && (
        <label>
          Architecture version
          <select value={activeId ?? ""} onChange={(event) => navigate(`/rule-check/${projectId}/${event.target.value}`)}>
            {checks.state.data.items.map((item) => <option key={item.id} value={item.id}>{item.label}{item.stale ? " (stale)" : ""}</option>)}
          </select>
        </label>
      )}
      {activeId && check.state.kind === "loading" && <Skeleton />}
      {activeId && check.state.kind === "disconnected" && <PendingData title="This check is not available yet" />}
      {activeId && check.state.kind === "error" && <ErrorState message={check.state.message} onRetry={check.reload} />}
      {data && (
        <>
          {data.stale && <p className="callout warning" role="status">This check is stale. {data.staleReason ?? "Run the check again after the design or the rules change."}</p>}
          <CoverageBar counts={data.counts} />
          <div className="ledger-split">
            <DataTable caption="Rule coverage" columns={columns} rows={rows} selectedId={current?.id} onSelect={setSelected} empty="No rows in this check." />
            <aside className="card stack" aria-live="polite">
              {!current && <p>Select a rule to compare the statement with the design.</p>}
              {current && (
                <div className="compare-pane">
                  <section>
                    <h2>Rule</h2>
                    <p className="mono">{current.ruleKey}</p>
                    <p>{current.statement}</p>
                    <p className="muted">{current.sourcePath ?? "No source path stored."}</p>
                  </section>
                  <section>
                    <h2>Design</h2>
                    <p>{current.componentName ?? "No covering component"}</p>
                    <p>{current.responsibility ?? "No responsibility is linked."}</p>
                    <p>{current.reason ?? "No extra reason stored."}</p>
                    {current.componentKey && <Link to={`/architecture/${projectId}`}>Open component in architecture</Link>}
                    <Link to={`/traceability/${projectId}/${current.ruleId}`}>Record migration decision</Link>
                  </section>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
