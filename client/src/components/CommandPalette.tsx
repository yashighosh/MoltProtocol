import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { GraphNode, IntentSummary } from "../types";

type Hit = { id: string; label: string; hint: string; to: string };

export function CommandPalette({ projectId, open, onClose }: { projectId?: string; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    if (!projectId) {
      setHits([]);
      return;
    }
    let stop = false;
    Promise.allSettled([
      api<{ nodes: GraphNode[] }>(`/api/v1/projects/${projectId}/graph`),
      api<{ summaries: IntentSummary[] }>(`/api/v1/projects/${projectId}/summaries`),
    ]).then(([graph, summaries]) => {
      if (stop) return;
      const next: Hit[] = [];
      if (graph.status === "fulfilled") {
        for (const node of graph.value.nodes) {
          next.push({ id: `m-${node.id}`, label: node.name, hint: "Module", to: `/dependency-map/${projectId}?module=${node.id}` });
        }
      }
      if (summaries.status === "fulfilled") {
        for (const summary of summaries.value.summaries) {
          next.push({ id: `s-${summary.id}`, label: summary.moduleName, hint: `${summary.confidence} confidence`, to: `/intent-summaries/${projectId}?summary=${summary.id}` });
        }
      }
      if (graph.status === "rejected" && summaries.status === "rejected") setError("This project has no searchable modules yet.");
      else setError("");
      setHits(next);
    });
    return () => { stop = true; };
  }, [open, projectId]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return hits.filter((hit) => !text || hit.label.toLowerCase().includes(text)).slice(0, 12);
  }, [hits, query]);

  if (!open) return null;
  return (
    <div className="palette" onClick={onClose}>
      <form role="dialog" aria-label="Search the project" onClick={(event) => event.stopPropagation()} onSubmit={(event) => event.preventDefault()}>
        <label>
          Search modules and summaries
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="invoice, scratch, billing" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} />
        </label>
        {!projectId && <p>Open a project to search its modules and summaries.</p>}
        {error && <p className="muted">{error}</p>}
        <ul>
          {visible.map((hit) => (
            <li key={hit.id}>
              <button type="button" className="result" onClick={() => { navigate(hit.to); onClose(); }}>
                <span className="path">{hit.label}</span>
                <span className="muted">{hit.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        {projectId && visible.length === 0 && <p className="muted">No match in the current project.</p>}
      </form>
    </div>
  );
}
