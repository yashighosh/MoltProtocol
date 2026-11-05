import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, lede, actions, preview }: { eyebrow?: string; title: string; lede?: string; actions?: ReactNode; preview?: string }) {
  const eyebrowText = eyebrow && eyebrow.toLowerCase() !== "live" ? eyebrow : undefined;
  const note = preview || (eyebrowText === "Preview" ? "Preview. This screen is waiting on server data and is not a live result." : undefined);
  return (
    <header className="page-head">
      <div className="stack" style={{ gap: 8 }}>
        {eyebrowText && <p className="eyebrow">{eyebrowText}</p>}
        <h1>{title}</h1>
        {lede && <p className="lead">{lede}</p>}
        {note && <p className="callout" role="note">{note}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}
