import { Link } from "react-router-dom";

export function Logo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <Link to="/" className="logo" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: inverse ? "var(--night-text)" : "inherit", textDecoration: "none" }} aria-label="MoltProtocol home">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={inverse ? "#f4eee3" : "#16150f"} />
        <circle cx="7" cy="16" r="2.1" fill="#c9a24a" />
        <circle cx="13" cy="10" r="2.1" fill={inverse ? "#16150f" : "#f4eee3"} />
        <circle cx="19" cy="17" r="2.1" fill={inverse ? "#16150f" : "#f4eee3"} />
        <circle cx="25" cy="12" r="2.1" fill="#c9a24a" />
        <path d="M7 16 L13 10 L19 17 L25 12" fill="none" stroke="#c9a24a" strokeWidth="1.3" />
      </svg>
      {!compact && <strong style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}>MoltProtocol</strong>}
    </Link>
  );
}
