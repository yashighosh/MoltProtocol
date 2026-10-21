import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import type { Project } from "../types";

export function BehaviorPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!projectId) return;
    api<Project>(`/api/v1/projects/${projectId}`).then(setProject).catch((reason: Error) => setError(reason.message));
  }, [projectId]);
  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;
  const tests = project?.files.filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file.path)) ?? [];
  return (
    <div className="stack">
      <PageHeader eyebrow="Preview" title="Behavior checks" preview="MoltProtocol never executes uploaded code, so no tests are run." lede="Test files found in the ingest are listed beside the module they appear to belong to." />
      {error && <ErrorState message={error} />}
      {!project && !error && <Skeleton />}
      {project && tests.length === 0 && <EmptyState title="No test files in this ingest">A file named like invoice.test.js would be listed here. None were stored.</EmptyState>}
      <ul className="stack">
        {tests.map((file) => {
          const modulePath = file.path.replace(/\.(test|spec)/, "");
          return (
            <li key={file.id} className="card row" style={{ justifyContent: "space-between" }}>
              <span className="path">{file.path}</span>
              <span>Linked by name to <span className="path">{modulePath}</span></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
