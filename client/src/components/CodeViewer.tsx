export function CodeViewer({ source, highlights, label = "Source" }: { source: string; highlights?: Set<number>; label?: string }) {
  const lines = source.length > 0 ? source.split("\n") : [];
  if (lines.length === 0) return <p className="muted">No source text is stored for this file.</p>;
  return (
    <div className="codeview" role="region" aria-label={label}>
      {lines.map((line, index) => (
        <div key={index} className={highlights?.has(index + 1) ? "hit" : undefined}>
          <span className="ln">{index + 1}</span>
          <code>{line || " "}</code>
        </div>
      ))}
    </div>
  );
}
