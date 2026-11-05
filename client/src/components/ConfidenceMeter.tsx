export function ConfidenceMeter({ level }: { level: string; score?: number }) {
  const bars = level === "high" ? 3 : level === "medium" ? 2 : 1;
  return (
    <span className={`meter meter-${level}`}>
      <span className="meter-bars" aria-hidden="true">
        {[1, 2, 3].map((step) => <i key={step} className={step <= bars ? "on" : ""} style={{ height: 4 + step * 3 }} />)}
      </span>
      <span className="meter-label">{level} confidence</span>
    </span>
  );
}
