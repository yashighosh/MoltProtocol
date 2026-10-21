import { AlertTriangle, Check, CircleAlert, CircleDot, Info, LoaderCircle } from "lucide-react";

const TONE: Record<string, string> = {
  complete: "preserved",
  confirmed: "preserved",
  corrected: "preserved",
  preserved: "preserved",
  high: "preserved",
  parsed: "preserved",
  running: "attention",
  queued: "attention",
  medium: "attention",
  potential: "attention",
  attention: "attention",
  failed: "error",
  blocked: "error",
  corrupted: "error",
  unsupported: "error",
  low: "error",
  error: "error",
  inferred: "navy",
  unresolved: "attention",
  reviewed: "navy",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONE[status] ?? "neutral";
  const text = label ?? status.replaceAll("_", " ");
  const Icon = status === "running" ? LoaderCircle : tone === "preserved" ? Check : tone === "attention" ? AlertTriangle : tone === "error" ? CircleAlert : tone === "navy" ? Info : CircleDot;
  return (
    <span className={`badge badge-${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {text}
    </span>
  );
}
