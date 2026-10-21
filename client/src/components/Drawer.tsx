import type { ReactNode } from "react";

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer stack" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>{title}</h2>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        {children}
      </aside>
    </div>
  );
}
