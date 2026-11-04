import type { ReactNode } from "react";

export function Inspector({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <aside className="inspector" aria-label={title}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{title}</h2>
        {onClose && <button type="button" className="secondary" onClick={onClose}>Close</button>}
      </div>
      {children}
    </aside>
  );
}
