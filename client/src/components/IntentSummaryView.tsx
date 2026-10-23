import { ConfidenceMeter } from "./ConfidenceMeter";
import { StatusBadge } from "./StatusBadge";
import type { IntentSummary } from "../types";

const RATIONALE: Record<string, string> = {
  commentCoverage: "Comment coverage",
  namingClarity: "Naming clarity",
  testPresence: "Nearby test",
  inverseComplexity: "Inverse complexity",
  importResolution: "Import resolution",
};

export function IntentSummaryView({ summary, showRationale = false }: { summary: IntentSummary; showRationale?: boolean }) {
  return (
    <article className="stack">
      <div className="row">
        <StatusBadge status={summary.confidence} label={`${summary.confidence} confidence`} />
        <StatusBadge status={summary.status} label={summary.status === "inferred" ? "Inferred, not validated" : summary.status} />
        {summary.mode === "llm" ? <StatusBadge status="inferred" label="Model draft" /> : <StatusBadge status="neutral" label="Demonstration analysis" />}
        <ConfidenceMeter level={summary.confidence} score={summary.confidenceScore} />
      </div>
      {summary.mode !== "llm" && (
        <p className="callout">Demonstration mode. This summary is a deterministic reading of names, comments, and calls. It is not output from a live language model.</p>
      )}
      {summary.confidence === "low" && (
        <p className="callout warning" role="status">
          <strong>Manual review required</strong>
          Confidence is low. Do not treat this summary as a settled description of the module.
        </p>
      )}
      {summary.sourceDrift && (
        <p className="callout warning" role="status">The source changed after validation. The signed-off text was kept. Review it again before relying on it.</p>
      )}
      <p>{summary.text}</p>
      {showRationale && (
        <div className="bars">
          {Object.entries(summary.rationale).map(([key, value]) => (
            <div className="bar-row" key={key}>
              <span>{RATIONALE[key] ?? key}</span>
              <i aria-hidden="true"><span style={{ width: `${Math.round(value * 100)}%` }} /></i>
              <span className="mono">{value}</span>
            </div>
          ))}
        </div>
      )}
      <h2>Source evidence</h2>
      <ul>
        {summary.evidence.map((item) => (
          <li key={`${item.path}-${item.startLine}-${item.reason}`}>
            <span className="path">{item.path}:{item.startLine}-{item.endLine}</span>. {item.reason}
          </li>
        ))}
      </ul>
      {summary.reviewerName && (
        <p>
          Reviewed by {summary.reviewerName} ({summary.identityLabel}) at {summary.reviewedAt ? new Date(summary.reviewedAt).toLocaleString() : "an unrecorded time"}.
        </p>
      )}
    </article>
  );
}
