import { CountUp } from "./CountUp";

export function StatTile({ label, value, unit, asOf }: { label: string; value: number | null; unit?: string; asOf?: string | null }) {
  return (
    <article className="stat-tile">
      <p>{label}</p>
      <strong>
        {value == null ? "Not assessed" : <CountUp to={value} label={`${value} ${label}`} />}
        {value != null && unit ? <span className="stat-unit"> {unit}</span> : null}
      </strong>
      <p className="muted">{asOf ? `As of ${asOf}` : "As of: not assessed"}</p>
    </article>
  );
}
