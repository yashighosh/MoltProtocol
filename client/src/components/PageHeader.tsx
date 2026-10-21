import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, lede, actions, preview }: { eyebrow?: string; title: string; lede?: string; actions?: ReactNode; preview?: string }) {
  return (
    <header className="page-head">
      <div className="stack" style={{ gap: 8 }}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lede && <p className="lead">{lede}</p>}
        {preview && <p className="preview-banner" role="note">{preview}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}
