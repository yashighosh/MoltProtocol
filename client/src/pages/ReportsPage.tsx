import { jsPDF } from "jspdf";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
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
      </div>
    </div>
  );
}
