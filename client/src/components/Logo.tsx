import { Link } from "react-router-dom";

export function Logo({ compact = false, inverse = false, size = 36 }: { compact?: boolean; inverse?: boolean; size?: number }) {
  return (
    <Link to="/" className={`logo${inverse ? " inverse" : ""}`} style={{ color: inverse ? "var(--night-text)" : "var(--espresso)" }} aria-label="MoltProtocol home">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill={inverse ? "#f4eee3" : "#2b1f17"} />
        <circle cx="7" cy="16" r="2.1" fill="#c9a24a" />
        <circle cx="13" cy="10" r="2.1" fill={inverse ? "#2b1f17" : "#f4eee3"} />
        <circle cx="19" cy="17" r="2.1" fill={inverse ? "#2b1f17" : "#f4eee3"} />
        <circle cx="25" cy="12" r="2.1" fill="#c9a24a" />
        <path d="M7 16 L13 10 L19 17 L25 12" fill="none" stroke="#c9a24a" strokeWidth="1.4" />
      </svg>
      {!compact && <strong>MoltProtocol</strong>}
    </Link>
  );
}
