import { Link } from "react-router-dom";

export function Logo({ compact = false, inverse = false, size = 36 }: { compact?: boolean; inverse?: boolean; size?: number }) {
  return (
    <Link to="/" className={`logo${inverse ? " inverse" : ""}`} aria-label="MoltProtocol home">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect className="logo-plate" width="32" height="32" rx="4" fill={inverse ? "var(--night-text)" : "var(--espresso)"} />
        <circle cx="7" cy="16" r="2.1" fill="var(--gold)" />
        <circle className="logo-dot" cx="13" cy="10" r="2.1" fill={inverse ? "var(--espresso)" : "var(--night-text)"} />
        <circle className="logo-dot" cx="19" cy="17" r="2.1" fill={inverse ? "var(--espresso)" : "var(--night-text)"} />
        <circle cx="25" cy="12" r="2.1" fill="var(--gold)" />
        <path d="M7 16 L13 10 L19 17 L25 12" fill="none" stroke="var(--gold)" strokeWidth="1.4" />
      </svg>
      {!compact && <strong>MoltProtocol</strong>}
    </Link>
  );
}
