import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import type { Project } from "../types";

type Meta = { supportedLanguages: string; gitHosts: string[]; discrepancyRule: string; persistence: string; identity: string };

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Meta>("/api/v1/meta").then(setMeta).catch((reason: Error) => setError(reason.message));
  }, []);
  useEffect(() => {
    if (!projectId) return;
    api<Project>(`/api/v1/projects/${projectId}`).then(setProject).catch((reason: Error) => setError(reason.message));
  }, [projectId]);

  async function signOut() {
    await api("/api/v1/auth/logout", { method: "POST" });
    setUser(null);
    navigate("/");
  }

  return (
    <div className="stack">
      <PageHeader eyebrow="Live" title="Settings" lede="The identity on this page is the same identity written onto a review." />
      {error && <ErrorState message={error} />}
      {!meta && !error && <Skeleton />}
      <article className="card stack">
        <h2>Identity</h2>
        <p>Signed in as {user?.displayName} · {user?.identityLabel}</p>
        <p className="path">{user?.email}</p>
        <button type="button" onClick={() => void signOut()}>Sign out</button>
      </article>
      <article className="card stack">
        <h2>Summary mode</h2>
        {project ? <p>{project.summaryMode === "llm" ? "Live model wording is enabled for this project. Confidence is still the local score." : "Demonstration mode. Summaries are a deterministic reading, not live model output."}</p> : <p>No project selected. Summary mode is stored on each project.</p>}
      </article>
      {meta && (
        <article className="card stack">
          <h2>Workbench limits</h2>
          <p>{meta.supportedLanguages}</p>
          <p>Git hosts: {meta.gitHosts.join(", ")}.</p>
          <p>{meta.discrepancyRule}</p>
          <p>{meta.persistence}</p>
          <p>{meta.identity}</p>
        </article>
      )}
    </div>
  );
}
