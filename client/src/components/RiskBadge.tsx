import { AlertTriangle, Check, CircleHelp, Minus } from "lucide-react";

const COPY = {
  low: { label: "Low risk", tone: "sage", Icon: Check },
  medium: { label: "Medium risk", tone: "taupe", Icon: Minus },
  high: { label: "High risk", tone: "danger", Icon: AlertTriangle },
  not_assessed: { label: "Not assessed", tone: "neutral", Icon: CircleHelp },
} as const;

export function RiskBadge({ band }: { band: keyof typeof COPY }) {
  const item = COPY[band] ?? COPY.not_assessed;
  const Icon = item.Icon;
  return (
    <span className={`badge risk-${item.tone}`}>
      <Icon size={13} aria-hidden="true" />
      {item.label}
    </span>
  );
}
