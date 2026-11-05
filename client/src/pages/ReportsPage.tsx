import { jsPDF } from "jspdf";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { getLeadership, getProposal, getRuleCheck, getSuite, listProposals, listRuleChecks, listSuites } from "../connection/modernize";
import type { Discrepancy, IntentSummary, TraceRow } from "../types";

function savePdf(title: string, lines: string[]) {
  const pdf = new jsPDF();
  pdf.setFontSize(16);
  pdf.text(title, 14, 18);
  pdf.setFontSize(10);
  let y = 28;
  for (const line of lines) {
    const parts = pdf.splitTextToSize(line, 180);
    if (y > 280) { pdf.addPage(); y = 18; }
    pdf.text(parts, 14, y);
    y += parts.length * 5 + 2;
  }
  pdf.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

function csvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function ReportsPage() {
  const { projectId } = useParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function run(kind: string, work: () => Promise<void>) {
    setBusy(kind);
    setError("");
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Report failed."); } finally { setBusy(""); }
  }

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Reports" lede="Files are built from the current project record. If a section has no rows, the file says so instead of filling in numbers." />
      {error && <ErrorState message={error} />}
      <div className="grid-cards">
        <article className="card stack">
          <h2>Intent summaries</h2>
          <button type="button" disabled={busy !== ""} onClick={() => void run("intent", async () => {
            const result = await api<{ summaries: IntentSummary[] }>(`/api/v1/projects/${projectId}/summaries`);
            const lines = result.summaries.length === 0 ? ["No summaries are stored."] : result.summaries.map((item) => `${item.moduleName} | ${item.confidence} | ${item.status} | ${item.text}`);
            savePdf("Intent summaries", lines);
          })}>{busy === "intent" ? "Building…" : "Download PDF"}</button>
        </article>
        <article className="card stack">
          <h2>Discrepancies</h2>
          <button type="button" disabled={busy !== ""} onClick={() => void run("diff", async () => {
            const result = await api<{ items: Discrepancy[]; message: string }>(`/api/v1/projects/${projectId}/discrepancies`);
            const lines = result.items.length === 0 ? [result.message || "No discrepancies are stored."] : result.items.map((item) => `#${item.impactRank} ${item.moduleName} ${item.ruleId}: ${item.description}`);
            savePdf("Discrepancies", lines);
          })}>{busy === "diff" ? "Building…" : "Download PDF"}</button>
        </article>
        <article className="card stack">
          <h2>Traceability</h2>
          <button type="button" disabled={busy !== ""} onClick={() => void run("trace", async () => {
            const result = await api<{ rows: TraceRow[] }>(`/api/v1/projects/${projectId}/traceability`);
            const lines = result.rows.length === 0 ? ["No trace rows are stored."] : result.rows.map((row) => `${row.path}:${row.startLine ?? "n/a"} | ${row.reviewStatus} | ${row.reviewerName ?? "none"} | ${row.discrepancy ?? "none"}`);
            savePdf("Traceability", lines);
          })}>{busy === "trace" ? "Building…" : "Download PDF"}</button>
          <button type="button" className="secondary" disabled={busy !== ""} onClick={() => void run("csv", async () => {
            const result = await api<{ rows: TraceRow[] }>(`/api/v1/projects/${projectId}/traceability`);
            const header = ["path", "startLine", "endLine", "intent", "reviewStatus", "reviewer", "identity", "discrepancy"];
            const body = result.rows.map((row) => [row.path, String(row.startLine ?? ""), String(row.endLine ?? ""), row.intentText ?? "", row.reviewStatus, row.reviewerName ?? "", row.identityLabel ?? "", row.discrepancy ?? ""].map(csvCell).join(","));
            const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "traceability.csv";
            anchor.click();
            URL.revokeObjectURL(url);
          })}>Download CSV</button>
        </article>
        <article className="card stack">
          <h2>Dependency map</h2>
          <a className="button secondary" href={`/api/v1/projects/${projectId}/graph.svg`}>Download SVG</a>
          <a className="button secondary" href={`/api/v1/projects/${projectId}/graph.pdf`}>Download print PDF</a>
        </article>
        <article className="card stack">
          <h2>Legacy Billing architecture</h2>
          <p className="muted">The recorded target boundaries for the Legacy Billing sample.</p>
          <button type="button" disabled={busy !== ""} onClick={() => void run("arch", async () => {
            const list = await listProposals(projectId);
            const proposal = list.items[0];
            if (!proposal) throw new Error("No architecture demonstration is stored for this project.");
            const detail = await getProposal(projectId, proposal.id);
            const lines = [
              detail.version.changeNote ?? "Legacy Billing demonstration.",
              ...detail.components.map((component) => {
                const modules = detail.mappings.filter((mapping) => mapping.componentId === component.id).map((mapping) => mapping.moduleName).join(", ");
                return `${component.name} (${component.kind}): ${modules || "no modules"}`;
              }),
            ];
            savePdf("Legacy Billing architecture", lines);
          })}>{busy === "arch" ? "Building…" : "Download PDF"}</button>
        </article>
        <article className="card stack">
          <h2>Legacy Billing rule preservation</h2>
          <p className="muted">Preserved, distorted, and dropped rules from the billing sample.</p>
          <button type="button" disabled={busy !== ""} onClick={() => void run("rules", async () => {
            const list = await listRuleChecks(projectId);
            const runId = list.items[0]?.id;
            if (!runId) throw new Error("No rule-preservation demonstration is stored for this project.");
            const check = await getRuleCheck(projectId, runId);
            const lines = [
              `${check.architectureLabel}. Preserved ${check.counts.preserved ?? "n/a"}, distorted ${check.counts.distorted ?? "n/a"}, dropped ${check.counts.dropped ?? "n/a"}.`,
              ...check.rows.map((row) => `${row.ruleKey} ${row.status}: ${row.statement}`),
            ];
            savePdf("Legacy Billing rule preservation", lines);
          })}>{busy === "rules" ? "Building…" : "Download PDF"}</button>
        </article>
        <article className="card stack">
          <h2>Legacy Billing behavior walkthrough</h2>
          <p className="muted">Recorded request comparison. No live endpoint is called.</p>
          <button type="button" disabled={busy !== ""} onClick={() => void run("behavior", async () => {
            const list = await listSuites(projectId);
            const suiteId = list.items[0]?.id;
            if (!suiteId) throw new Error("No behavior demonstration is stored for this project.");
            const suite = await getSuite(projectId, suiteId);
            const lines = [
              `${suite.name}. Legacy: ${suite.legacy?.name ?? "none"}. Target: ${suite.modernized?.name ?? "none"}.`,
              ...suite.cases.map((item) => `${item.outcome} ${item.method} ${item.path} — ${item.name}`),
            ];
            savePdf("Legacy Billing behavior", lines);
          })}>{busy === "behavior" ? "Building…" : "Download PDF"}</button>
        </article>
        <article className="card stack">
          <h2>Legacy Billing leadership</h2>
          <p className="muted">Counts from this project's stored intent, plus the recorded rule and behavior lines.</p>
          <button type="button" disabled={busy !== ""} onClick={() => void run("lead", async () => {
            const overview = await getLeadership(projectId);
            savePdf("Legacy Billing leadership", [
              overview.narrative ?? "No narrative stored.",
              `Verified ${overview.verified ?? "not assessed"}. Unexamined ${overview.unexamined ?? "not assessed"}. Not analyzable ${overview.notAnalyzable ?? "not assessed"}. High risk ${overview.highRisk ?? "not assessed"}.`,
              overview.rulesLine ?? "",
              overview.behaviorLine ?? "",
            ]);
          })}>{busy === "lead" ? "Building…" : "Download PDF"}</button>
        </article>
      </div>
    </div>
  );
}
