import { Link, useParams } from "react-router-dom";
import { DataTable, type Column } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterBar, useFilterParams } from "../components/FilterBar";
import { PageHeader } from "../components/PageHeader";
import { PendingData } from "../components/PendingData";
import { RiskBadge } from "../components/RiskBadge";
import { Skeleton } from "../components/Skeleton";
import { StatTile } from "../components/StatTile";
import type { LeadershipModule } from "../connection/contracts";
import { getLeadership, listLeadershipModules } from "../connection/modernize";
import { useLoad } from "../hooks/useLoad";

const BANDS = [
  { id: "all", label: "All bands" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "not_assessed", label: "Not assessed" },
];

export function LeadershipPage() {
  const { projectId } = useParams();
  const { params, setFilter } = useFilterParams();
  const sort = params.get("sort") ?? "risk";
  const dir = params.get("dir") === "asc" ? "asc" : "desc";
  const band = params.get("band") ?? "all";
  const q = params.get("q") ?? "";
  const overview = useLoad(() => getLeadership(projectId!), [projectId]);
  const modules = useLoad(
    () => listLeadershipModules(projectId!, { sort, dir, band: band === "all" ? undefined : band, q: q || undefined }),
    [projectId, sort, dir, band, q],
  );

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;

  function onSort(id: string) {
    const nextDir = sort === id && dir === "desc" ? "asc" : "desc";
    setFilter("sort", id);
    setFilter("dir", nextDir);
  }

  const columns: Column<LeadershipModule>[] = [
    { id: "name", header: "Area", sortable: true, render: (row) => <span>{row.name}{row.path ? <span className="muted"> {row.path}</span> : null}</span> },
    { id: "size", header: "Size", sortable: true, render: (row) => row.loc == null ? "Not assessed" : `${row.loc} lines` },
    { id: "verified", header: "Status", sortable: true, render: (row) => row.verified == null ? "Not assessed" : row.verified ? "Verified" : "Not yet examined" },
    { id: "risk", header: "Risk", sortable: true, render: (row) => <RiskBadge band={row.band} /> },
    { id: "why", header: "Why", render: (row) => row.reasons.length ? row.reasons.join(" ") : "Not assessed" },
  ];

  const data = overview.state.kind === "ready" ? overview.state.data : null;
  const parts = [data?.verified, data?.unexamined, data?.notAnalyzable];
  const shareReady = parts.every((value) => value != null);
  const shareTotal = shareReady ? (data!.verified! + data!.unexamined! + data!.notAnalyzable!) : 0;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Demonstration"
        title="Leadership view"
        lede="Verified means an expert confirmed the intent and the source has not drifted. Unexamined means that confirmation is still missing. Risk is shown only when enough recorded factors exist."
      />
      {overview.state.kind === "ready" && data?.behaviorLine?.includes("recorded comparison") && (
        <p className="callout" role="status">Demonstration for Legacy Billing. Verified and unexamined counts come from this project's stored intent. The rule and behavior lines are the recorded walkthrough.</p>
      )}
      {overview.state.kind === "loading" && <Skeleton lines={4} />}
      {overview.state.kind === "error" && <ErrorState message={overview.state.message} onRetry={overview.reload} />}
      {overview.state.kind === "disconnected" && <PendingData title="Leadership figures are not assessed yet" />}
      <p className="lead-headline">{data?.narrative ?? "A plain summary will appear here when modernization records are connected. No percentage is guessed."}</p>
      <div className="grid-3">
        <StatTile label="Verified" value={data?.verified ?? null} unit="areas" asOf={data?.asOf} />
        <StatTile label="Not yet examined" value={data?.unexamined ?? null} unit="areas" asOf={data?.asOf} />
        <StatTile label="High risk" value={data?.highRisk ?? null} unit="areas" asOf={data?.asOf} />
      </div>
      <div className="share-bar" role="img" aria-label={shareReady ? `${data?.verified} verified, ${data?.unexamined} not yet examined, ${data?.notAnalyzable} not analyzable` : "Share of the codebase is not assessed"}>
        {shareReady && shareTotal > 0 && (
          <>
            <span className="share-verified" style={{ flexGrow: data!.verified! }}>Verified</span>
            <span className="share-unexamined" style={{ flexGrow: data!.unexamined! }}>Not yet examined</span>
            <span className="share-blocked" style={{ flexGrow: data!.notAnalyzable! }}>Not analyzable</span>
          </>
        )}
      </div>
      <p className="muted">{data?.rulesLine ?? "Rule decisions: not assessed."} {data?.behaviorLine ?? "Behavior runs: not assessed."}</p>
      <FilterBar
        label="Areas"
        chips={BANDS}
        chip={band}
        onChip={(id) => setFilter("band", id)}
        search={q}
        onSearch={(value) => setFilter("q", value)}
      />
      {modules.state.kind === "loading" && <Skeleton />}
      {modules.state.kind === "error" && <ErrorState message={modules.state.message} onRetry={modules.reload} />}
      {modules.state.kind === "disconnected" && <p className="muted">The area table will sort and filter from stored risk records.</p>}
      {modules.state.kind === "ready" && (
        <DataTable
          caption="Areas by risk"
          columns={columns}
          rows={modules.state.data.items}
          sort={sort}
          dir={dir}
          onSort={onSort}
          empty="No areas match this filter."
        />
      )}
    </div>
  );
}
