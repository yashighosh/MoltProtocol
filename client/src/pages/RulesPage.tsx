import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable, type Column } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterBar, useFilterParams } from "../components/FilterBar";
import { Inspector } from "../components/Inspector";
import { PageHeader } from "../components/PageHeader";
import { PendingData } from "../components/PendingData";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import type { RuleRow } from "../connection/contracts";
import { listRules } from "../connection/modernize";
import { useLoad } from "../hooks/useLoad";

const STATUSES = [
  { id: "all", label: "All" },
  { id: "candidate", label: "Candidate" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
];

export function RulesPage() {
  const { projectId } = useParams();
  const { params, setFilter } = useFilterParams();
  const status = params.get("status") ?? "all";
  const q = params.get("q") ?? "";
  const rules = useLoad(() => listRules(projectId!, { status: status === "all" ? undefined : status, q: q || undefined }), [projectId, status, q]);
  const [selected, setSelected] = useState<string | null>(null);

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;

  const rows = rules.state.kind === "ready" ? rules.state.data.items : [];
  const current = rows.find((row) => row.id === selected) ?? null;
  const columns: Column<RuleRow>[] = [
    { id: "key", header: "Rule", render: (row) => <span className="mono">{row.ruleKey}</span> },
    { id: "statement", header: "Statement", render: (row) => row.statement },
    { id: "module", header: "Module", render: (row) => row.moduleName ?? "Not linked" },
    {
      id: "status",
      header: "Status",
      render: (row) => (
        <span className="stack-tight">
          <StatusBadge status={row.status === "accepted" ? "confirmed" : "attention"} label={row.status} />
          {!row.counted && <span className="muted">Not counted until accepted</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Demonstration"
        title="Rules"
        lede="Candidate sentences come from validated intent. They are not counted in coverage or compliance until an architect accepts them."
      />
      <FilterBar label="Rules" segments={STATUSES} segment={status} onSegment={(id) => setFilter("status", id)} search={q} onSearch={(value) => setFilter("q", value)} />
      {rules.state.kind === "ready" && rows.some((row) => row.ruleKey === "BR-B01") && (
        <p className="callout" role="status">Demonstration for Legacy Billing. These are the sample's billing rules, marked accepted so preservation and traceability can count them.</p>
      )}
      {rules.state.kind === "loading" && <Skeleton lines={5} />}
      {rules.state.kind === "error" && <ErrorState message={rules.state.message} onRetry={rules.reload} />}
      {rules.state.kind === "disconnected" && <PendingData title="No rule registry yet" />}
      {rules.state.kind === "ready" && (
        <div className="ledger-split">
          <DataTable caption="Rule registry" columns={columns} rows={rows} selectedId={selected} onSelect={setSelected} empty="No rules match this filter." />
          {current && (
            <Inspector title={current.ruleKey} onClose={() => setSelected(null)}>
              <p>{current.statement}</p>
              <p className="muted">{current.moduleName ?? "No module linked"}</p>
              {!current.counted && <p>Not counted until accepted.</p>}
            </Inspector>
          )}
        </div>
      )}
    </div>
  );
}
