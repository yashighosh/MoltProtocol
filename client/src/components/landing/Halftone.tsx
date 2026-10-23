export function Halftone({ kind }: { kind: "inferred" | "validated" | "flagged" }) {
  const dots: { x: number; y: number; r: number }[] = [];
  for (let y = 12; y < 150; y += 10) {
    for (let x = 12; x < 250; x += 10) {
      const wave = kind === "inferred" ? Math.sin(x / 18) * 22 : kind === "validated" ? Math.abs(80 - x) / 6 : Math.sin(x / 12) * Math.cos(y / 16) * 18;
      const band = Math.abs(y - 80 - wave);
      if (band < 28) dots.push({ x, y, r: band < 10 ? 3.2 : 2 });
    }
  }
  return (
    <svg viewBox="0 0 260 160" aria-hidden="true">
      {dots.map((dot) => <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r={dot.r} fill={kind === "flagged" ? "#c9a24a" : "#263b50"} />)}
    </svg>
  );
}
