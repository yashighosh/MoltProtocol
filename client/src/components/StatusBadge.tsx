const TONE: Record<string, string> = {
  complete: "preserved",
  confirmed: "preserved",
  corrected: "preserved",
  preserved: "preserved",
  high: "preserved",
  running: "attention",
  queued: "attention",
  medium: "attention",
  potential: "attention",
  attention: "attention",
  failed: "error",
  blocked: "error",
  corrupted: "error",
  low: "error",
  error: "error",
  inferred: "navy",
  unresolved: "attention",
  reviewed: "navy",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONE[status] ?? "neutral";
  const text = label ?? status.replaceAll("_", " ");
  return (
    <span className={`badge badge-${tone}`}>
      <i aria-hidden="true" />
      {text}
    </span>
  );
}
