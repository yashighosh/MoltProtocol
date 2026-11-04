import type { ReactNode } from "react";

const STAGES = ["Legacy source", "Intent", "Architecture", "Status"] as const;

export function TraceChain({ stages }: { stages: Record<(typeof STAGES)[number], ReactNode> }) {
  return (
    <ol className="trace-chain">
      {STAGES.map((name, index) => (
        <li key={name}>
          <span className="trace-index" aria-hidden="true">{index + 1}</span>
          <h3>{name}</h3>
          <div>{stages[name]}</div>
        </li>
      ))}
    </ol>
  );
}
