export function ConfidenceMeter({ level, score }: { level: string; score?: number }) {
  const width = score != null ? Math.round(Math.max(0, Math.min(1, score)) * 100) : level === "high" ? 84 : level === "medium" ? 56 : 32;
  return (
    <span className={`meter meter-${level}`}>
      <span className="meter-label">{level} confidence</span>
      <span className="meter-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></span>
    </span>
  );
}
