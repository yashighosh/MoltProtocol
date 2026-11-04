import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Inspector } from "../components/Inspector";
import { JobStatus } from "../components/JobStatus";
import { PageHeader } from "../components/PageHeader";
import { PendingData } from "../components/PendingData";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import type { ProposalDetail } from "../connection/contracts";
import type { EditOperation } from "../connection/modernize";
import { createProposal, getProposal, listProposals, saveProposalEdits } from "../connection/modernize";
import { useLoad } from "../hooks/useLoad";

function withMoves(detail: ProposalDetail, operations: EditOperation[]): ProposalDetail {
  const mappings = detail.mappings.map((mapping) => ({ ...mapping }));
  const components = detail.components.map((component) => ({ ...component }));
  for (const operation of operations) {
    if (operation.op === "move_module") {
      const target = components.find((component) => component.componentKey === operation.toComponentKey);
      const mapping = mappings.find((item) => item.moduleId === operation.moduleId);
      if (target && mapping) {
        mapping.componentId = target.id;
        mapping.rationale = operation.rationale;
      }
    }
    if (operation.op === "rename_component") {
      const component = components.find((item) => item.componentKey === operation.componentKey);
      if (component) component.name = operation.name;
    }
    if (operation.op === "set_kind") {
      const component = components.find((item) => item.componentKey === operation.componentKey);
      if (component) component.kind = operation.kind;
    }
  }
  return { ...detail, components, mappings };
}

export function ArchitecturePage() {
  const { projectId, proposalId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const list = useLoad(() => listProposals(projectId!), [projectId]);
  const detailLoad = useLoad(() => (proposalId ? getProposal(projectId!, proposalId) : Promise.resolve(null)), [projectId, proposalId]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [operations, setOperations] = useState<EditOperation[]>([]);
  const [note, setNote] = useState("");
  const [move, setMove] = useState<{ moduleId: string; name: string } | null>(null);
  const [targetKey, setTargetKey] = useState("");
  const [rationale, setRationale] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const detail = detailLoad.state.kind === "ready" ? detailLoad.state.data : null;
  const view = useMemo(() => (detail ? withMoves(detail, operations) : null), [detail, operations]);
  const selected = view?.components.find((component) => component.componentKey === selectedKey) ?? view?.components[0] ?? null;

  async function generate() {
    if (!projectId) return;
    setActionError("");
    try {
      const created = await createProposal(projectId, "Target architecture");
      setJobId(created.jobId);
      toast("Proposal requested. It will show here when the job finishes.");
      if (created.proposalId) navigate(`/architecture/${projectId}/${created.proposalId}`);
    } catch (reason) {
      setActionError(reason instanceof ApiError ? reason.message : "The proposal could not be requested until the database is connected.");
    }
  }

  async function save() {
    if (!projectId || !proposalId || !detail) return;
    setActionError("");
    try {
      await saveProposalEdits(projectId, proposalId, { baseVersion: detail.version.version, changeNote: note || "Manual edit", operations });
      setOperations([]);
      setEditing(false);
      toast("Saved as a new version.");
      detailLoad.reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Save failed.");
    }
  }

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Preview"
        title="Architecture"
        lede="A target architecture grounded in validated intent. Each component should say which legacy modules map into it and why. Static structure is not proof of runtime behavior."
        actions={<button type="button" onClick={() => void generate()}>Generate from validated intent</button>}
      />
      {projectId && <JobStatus projectId={projectId} jobId={jobId} />}
      {actionError && <ErrorState message={actionError} />}
      {list.state.kind === "loading" && <Skeleton lines={4} />}
      {list.state.kind === "error" && <ErrorState message={list.state.message} onRetry={list.reload} />}
      {list.state.kind === "disconnected" && <PendingData title="No architecture records yet" />}
      {list.state.kind === "ready" && (
        <div className="arch">
          <aside className="arch-rail stack-tight" aria-label="Proposals">
            <h2>Proposals</h2>
            {list.state.data.items.length === 0 && <p>No proposal is stored yet.</p>}
            {list.state.data.items.map((item) => (
              <button key={item.id} type="button" className="secondary proposal-link" onClick={() => navigate(`/architecture/${projectId}/${item.id}`)}>
                {item.name}{item.version != null ? ` · v${item.version}` : ""}
              </button>
            ))}
          </aside>
          <section className="arch-canvas stack" aria-label="Architecture diagram">
            {!proposalId && <EmptyState title="Select a proposal">Generate one, or open a stored proposal from the list.</EmptyState>}
            {proposalId && detailLoad.state.kind === "loading" && <Skeleton />}
            {proposalId && detailLoad.state.kind === "disconnected" && <PendingData title="This proposal is not available yet" />}
            {proposalId && detailLoad.state.kind === "error" && <ErrorState message={detailLoad.state.message} onRetry={detailLoad.reload} />}
            {view && (
              <>
                {view.staleReason && <p className="callout warning" role="status">Rule checks are stale. {view.staleReason}</p>}
                <div className="row">
                  <button type="button" className="secondary" aria-pressed={editing} onClick={() => setEditing((value) => !value)}>{editing ? "Leave edit mode" : "Edit"}</button>
                  {editing && <button type="button" onClick={() => void save()} disabled={operations.length === 0}>Save as new version</button>}
                </div>
                {editing && (
                  <label>
                    Change note
                    <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why this version changed" />
                  </label>
                )}
                <ArchitectureSvg detail={view} selectedKey={selected?.componentKey ?? null} onSelect={setSelectedKey} />
                <div className="tray">
                  <h2>Excluded and retired</h2>
                  <ul>
                    {view.scope.filter((item) => item.state !== "mapped").map((item) => (
                      <li key={item.moduleId}><span className="path">{item.moduleName}</span>: {item.state.replaceAll("_", " ")}. {item.reason ?? "No reason stored."}</li>
                    ))}
                    {view.scope.filter((item) => item.state !== "mapped").length === 0 && <li>None recorded.</li>}
                  </ul>
                </div>
                <table>
                  <caption className="visually-hidden">Components and mapped modules</caption>
                  <thead><tr><th>Component</th><th>Modules</th></tr></thead>
                  <tbody>
                    {view.components.map((component) => (
                      <tr key={component.id}>
                        <td>{component.name}</td>
                        <td>{view.mappings.filter((mapping) => mapping.componentId === component.id).map((mapping) => mapping.moduleName).join(", ") || "None"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
          {selected && view && (
            <Inspector title={selected.name}>
              <p className="badge badge-navy">{selected.kind}</p>
              <p>{selected.boundaryRationale}</p>
              <h3>Responsibilities</h3>
              <ul>
                {view.responsibilities.filter((item) => item.componentId === selected.id).map((item) => (
                  <li key={item.id}>{item.ruleKey ? <span className="mono">{item.ruleKey}</span> : null} {item.statement}</li>
                ))}
              </ul>
              <h3>Mapped modules</h3>
              <ul className="stack-tight">
                {view.mappings.filter((mapping) => mapping.componentId === selected.id).map((mapping) => (
                  <li key={mapping.id}>
                    <strong className="path">{mapping.moduleName}</strong>
                    <p>{mapping.rationale}</p>
                    <p>{mapping.intentText ?? "No intent sentence stored."}</p>
                    <p className="muted">{mapping.reviewerName ? `Reviewed by ${mapping.reviewerName}` : "No reviewer stored"}{mapping.reviewedAt ? ` on ${mapping.reviewedAt}` : ""}</p>
                    {mapping.reviewHref && <Link to={mapping.reviewHref}>Open intent review</Link>}
                    {editing && (
                      <button type="button" className="secondary" onClick={() => { setMove({ moduleId: mapping.moduleId, name: mapping.moduleName }); setTargetKey(selected.componentKey); setRationale(""); }}>
                        Move to
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Inspector>
          )}
        </div>
      )}
      {move && view && (
        <ConfirmDialog
          title={`Move ${move.name}`}
          confirmLabel="Stage move"
          onCancel={() => setMove(null)}
          onConfirm={() => {
            if (!rationale.trim() || !targetKey) return;
            setOperations((current) => [...current, { op: "move_module", moduleId: move.moduleId, toComponentKey: targetKey, rationale: rationale.trim() }]);
            setMove(null);
          }}
        >
          <label>
            Destination
            <select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
              {view.components.map((component) => <option key={component.componentKey} value={component.componentKey}>{component.name}</option>)}
            </select>
          </label>
          <label>
            Why this module moves
            <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} required />
          </label>
          {!rationale.trim() && <p className="muted">A rationale is required. The earlier generated reason stays in version history.</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}

function ArchitectureSvg({ detail, selectedKey, onSelect }: { detail: ProposalDetail; selectedKey: string | null; onSelect: (key: string) => void }) {
  const width = 760;
  const height = 440;
  const boxW = 200;
  const boxH = 120;
  const columns = Math.max(1, Math.ceil(Math.sqrt(detail.components.length)));
  return (
    <svg className="arch-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Proposed components and relationships">
      <title>Proposed components</title>
      {detail.relationships.map((link) => {
        const from = detail.components.findIndex((component) => component.id === link.fromComponentId);
        const to = detail.components.findIndex((component) => component.id === link.toComponentId);
        if (from < 0 || to < 0) return null;
        const a = boxPoint(from, columns, boxW, boxH);
        const b = boxPoint(to, columns, boxW, boxH);
        return <line key={link.id} x1={a.x + boxW / 2} y1={a.y + boxH} x2={b.x + boxW / 2} y2={b.y} stroke="#263B50" strokeWidth="1.4" />;
      })}
      {detail.components.map((component, index) => {
        const point = boxPoint(index, columns, boxW, boxH);
        const modules = detail.mappings.filter((mapping) => mapping.componentId === component.id);
        return (
          <g key={component.id} onClick={() => onSelect(component.componentKey)} style={{ cursor: "pointer" }}>
            <rect x={point.x} y={point.y} width={boxW} height={boxH} rx="14" fill={selectedKey === component.componentKey ? "#d8e8e8" : "#fbf8f2"} stroke="#263B50" />
            <text x={point.x + 12} y={point.y + 24} fill="#1d1b17" fontSize="14">{component.name}</text>
            <text x={point.x + 12} y={point.y + 42} fill="#625a4e" fontSize="11">{component.kind}</text>
            <text x={point.x + 12} y={point.y + 64} fill="#1f5c60" fontSize="11">{modules.length} legacy modules</text>
          </g>
        );
      })}
    </svg>
  );
}

function boxPoint(index: number, columns: number, boxW: number, boxH: number) {
  const col = index % columns;
  const row = Math.floor(index / columns);
  return { x: 24 + col * (boxW + 28), y: 24 + row * (boxH + 28) };
}
