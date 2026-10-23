import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import type { Project } from "../types";

export type Notice = { id: string; text: string };

export function watchProject(previous: Project | null, next: Project): Notice[] {
  if (!previous) return [];
  const notes: Notice[] = [];
  const fields: [keyof Project, string][] = [
    ["ingestionStatus", "Ingestion"],
    ["analysisStatus", "Dependency analysis"],
    ["summaryStatus", "Intent summaries"],
    ["discrepancyStatus", "Discrepancy detection"],
  ];
  for (const [field, label] of fields) {
    if (previous[field] !== next[field]) notes.push({ id: `${field}-${next.updatedAt}-${String(next[field])}`, text: `✓ ${label} is now ${String(next[field]).replaceAll("_", " ")}.` });
  }
  return notes;
}

export function NotificationBell({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  useEffect(() => { if (open) setSeen(notices.length); }, [open, notices.length]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const unread = Math.max(0, notices.length - seen);
  return (
    <div className="bell">
      <button type="button" className="icon-btn chrome-control" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Bell size={18} />
        {unread > 0 && <span className="bell-count">{unread}</span>}
      </button>
      {open && (
        <div className="note-pop" role="region" aria-label="Recent job updates">
          {notices.length === 0 && <p className="muted">No job changes in this session.</p>}
          {notices.slice(0, 6).map((notice) => <p key={notice.id}>{notice.text}</p>)}
        </div>
      )}
    </div>
  );
}
