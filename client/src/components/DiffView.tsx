import type { DiffEntry } from "../connection/contracts";

export function DiffView({ legacy, modernized, entries }: { legacy: string | null; modernized: string | null; entries: DiffEntry[] }) {
  return (
    <div className="diff-view">
      <div className="diff-panes">
        <section aria-label="Legacy output">
          <h3>Legacy</h3>
          <pre className="code">{legacy ?? "No body stored"}</pre>
        </section>
        <section aria-label="Modernized output">
          <h3>Modernized</h3>
          <pre className="code">{modernized ?? "No body stored"}</pre>
        </section>
      </div>
      <ol className="diff-list">
        {entries.length === 0 && <li>No differing paths stored.</li>}
        {entries.map((entry) => (
          <li key={`${entry.kind}-${entry.path}`} className={`diff-${entry.kind}`}>
            <span className="mono">{entry.path || "(status)"}</span>
            <span>{entry.kind.replaceAll("_", " ")}</span>
            <span>Legacy: {entry.legacy ?? "absent"}</span>
            <span>Modernized: {entry.modernized ?? "absent"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
