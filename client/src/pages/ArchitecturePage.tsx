import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import type { GraphEdge, GraphNode } from "../types";

export function ArchitecturePage() {
  const { projectId } = useParams();
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[]; message: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    api<{ nodes: GraphNode[]; edges: GraphEdge[]; message: string }>(`/api/v1/projects/${projectId}/graph`)
      .then(setGraph)
      .catch((reason: Error) => setError(reason.message));
  }, [projectId]);

  const groups = useMemo(() => {
    const map = new Map<string, { modules: string[]; outbound: Set<string> }>();
    for (const node of graph?.nodes ?? []) {
      const directory = node.kind === "file" ? node.directory : "Missing targets";
      const current = map.get(directory) ?? { modules: [], outbound: new Set<string>() };
      current.modules.push(node.name);
      map.set(directory, current);
    }
    const byId = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
    for (const edge of graph?.edges ?? []) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) continue;
      const fromKey = from.kind === "file" ? from.directory : "Missing targets";
      const toKey = to.kind === "file" ? to.directory : "a missing file";
      if (fromKey === toKey) continue;
      map.get(fromKey)?.outbound.add(toKey);
    }
    return [...map.entries()];
  }, [graph]);

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Preview"
        title="Architecture draft"
        preview="Draft grouping from your directory clusters. Not a validated recommendation."
        lede="Directories in this ingest are drawn as groups. A line between groups is only an import or call that already exists."
      />
      {error && <ErrorState message={error} />}
      {!graph && !error && <Skeleton />}
      {graph && groups.length === 0 && <EmptyState title="No directory groups yet">Run dependency analysis before expecting a grouping.</EmptyState>}
      <div className="grid-cards">
        {groups.map(([directory, group]) => (
          <article key={directory} className="card stack">
            <h2 className="path">{directory || "(root)"}</h2>
            <p>{group.modules.length} modules in this directory.</p>
            <ul>{group.modules.slice(0, 8).map((name) => <li key={name} className="path">{name}</li>)}</ul>
            <p>{group.outbound.size === 0 ? "No calls leave this directory." : `Calls leave toward ${[...group.outbound].join(", ")}.`}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
