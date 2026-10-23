export function ProgressRing({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = 58;
  const circ = 2 * Math.PI * radius;
  return (
    <svg className="ring" viewBox="0 0 148 148" role="img" aria-label={label}>
      <circle cx="74" cy="74" r={radius} fill="none" stroke="var(--bg-sunken)" strokeWidth="10" />
      <circle
        cx="74" cy="74" r={radius} fill="none" stroke="var(--navy)" strokeWidth="10"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - clamped)} strokeLinecap="round"
        transform="rotate(-90 74 74)"
      />
      <text x="74" y="80" textAnchor="middle">{Math.round(clamped * 100)}%</text>
    </svg>
  );
}
