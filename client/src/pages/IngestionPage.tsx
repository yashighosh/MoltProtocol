import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { IngestionChooser } from "../components/IngestionChooser";
import { StatusBadge } from "../components/StatusBadge";
import type { Project } from "../types";

export function IngestionPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    let stop = false;
    let timer = 0;
    const tick = () => {
      api<Project>(`/api/v1/projects/${projectId}`).then((result) => {
        if (stop) return;
        setProject(result);
        if (result.ingestionStatus === "queued" || result.ingestionStatus === "running") timer = window.setTimeout(tick, 700);
      }).catch((reason: Error) => {
        if (!stop) setError(reason.message);
      });
    };
    tick();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [projectId]);

  async function submit(path: string, body: BodyInit, json = false) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ projectId: string }>(path, { method: "POST", body, headers: json ? { "Content-Type": "application/json" } : undefined });
      navigate(`/ingestion/${result.projectId}`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  const running = project?.ingestionStatus === "queued" || project?.ingestionStatus === "running";

  return (
    <div className="stack">
      <div>
        <h1>Legacy codebase ingestion</h1>
        <p className="lede">Submit a codebase to parse. Unsupported and corrupted files stay in the summary with a reason. The page shows the stage that is actually running.</p>
      </div>
      {!projectId && (
        <section className="panel">
          <IngestionChooser
            busy={busy}
            serverError={error}
            onUpload={(name, files) => {
              const form = new FormData();
              form.set("name", name);
              const archive = files.find((file) => file.name.toLowerCase().endsWith(".zip"));
              if (archive && files.length === 1) form.append("archive", archive);
              else files.forEach((file) => form.append("files", file, file.webkitRelativePath || file.name));
              void submit("/api/v1/projects/upload", form);
            }}
            onGit={(name, url) => void submit("/api/v1/projects/git", JSON.stringify({ name, url }), true)}
            onSample={(name) => void submit("/api/v1/projects/sample", JSON.stringify({ name }), true)}
          />
        </section>
      )}
      {error && projectId && <p className="callout error" role="alert">{error}</p>}
      {project && (
        <section className="panel stack" aria-live="polite">
          <div className="row">
            <h2>{project.name}</h2>
            <StatusBadge status={project.ingestionStatus} label={running ? `Stage: ${project.ingestionStage}` : project.ingestionStatus} />
          </div>
          {running && <p>Current stage: {project.ingestionStage}. This updates from the job record, not a timer.</p>}
          <ol>
            {project.stages.map((stage) => <li key={`${stage.stage}-${stage.createdAt}`}>{stage.stage}{stage.detail ? ` — ${stage.detail}` : ""}</li>)}
          </ol>
          {project.ingestionStatus === "failed" && (
            <div className="callout error">
              <strong>Ingestion failed</strong>
              {project.ingestionError}
              <div><button type="button" onClick={() => void submit(`/api/v1/projects/${project.id}/retry`, "")}>Retry ingestion</button></div>
            </div>
          )}
          {project.ingestionStatus === "complete" && (
            <>
              <p>{project.summary.fileCount} files · {project.summary.parsedCount} parsed · {project.summary.rejectedCount} flagged · {project.summary.totalLoc} lines of code.</p>
              <p>Languages: {project.summary.languages.map((item) => `${item.language} (${item.files} files, ${item.loc} LOC)`).join(", ") || "none parsed"}.</p>
              <table>
                <thead><tr><th>Path</th><th>Status</th><th>Language</th><th>LOC</th><th>Reason</th></tr></thead>
                <tbody>
                  {project.files.map((file) => (
                    <tr key={file.id}>
                      <td className="path">{file.path}</td>
                      <td><StatusBadge status={file.status} /></td>
                      <td>{file.language ?? "—"}</td>
                      <td className="mono">{file.loc ?? "—"}</td>
                      <td>{file.rejectionReason ?? "Parsed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link className="button" to={`/dependency-map/${project.id}`}>Proceed to dependency analysis</Link>
            </>
          )}
        </section>
      )}
    </div>
  );
}
