import { AlertTriangle, Ban, Check, CircleDot, Eye, MinusCircle } from "lucide-react";
import { shownCount } from "../hooks/useLoad";

const SEGMENTS = [
  { key: "preserved", label: "Preserved", icon: Check, tone: "sage" },
  { key: "mentionedOnly", label: "Mentioned only", icon: Eye, tone: "taupe" },
  { key: "distorted", label: "Distorted", icon: AlertTriangle, tone: "warn" },
  { key: "dropped", label: "Dropped", icon: Ban, tone: "danger" },
  { key: "retired", label: "Retired", icon: MinusCircle, tone: "navy" },
  { key: "notInScope", label: "Not in scope", icon: CircleDot, tone: "neutral" },
] as const;

export function CoverageBar({ counts }: { counts: Record<(typeof SEGMENTS)[number]["key"], number | null> }) {
  const known = SEGMENTS.map((segment) => counts[segment.key]).filter((value): value is number => value != null);
  const total = known.reduce((sum, value) => sum + value, 0);
  const assessed = known.length === SEGMENTS.length;
  return (
    <figure className="coverage">
      <div className="coverage-track" role="img" aria-label={SEGMENTS.map((segment) => `${segment.label} ${shownCount(counts[segment.key])}`).join(", ")}>
        {assessed && total > 0 && SEGMENTS.map((segment) => (
          <span key={segment.key} className={`cov-${segment.tone}`} style={{ flexGrow: counts[segment.key] ?? 0 }} />
        ))}
        {(!assessed || total === 0) && <span className="cov-neutral" style={{ flexGrow: 1 }} />}
      </div>
      <figcaption className="legend coverage-legend">
        {SEGMENTS.map((segment) => {
          const Icon = segment.icon;
          return (
            <span key={segment.key}>
              <Icon size={14} aria-hidden="true" /> {segment.label}: {shownCount(counts[segment.key])}
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}
