import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { StatusBadge } from "../components/StatusBadge";
import { useEffect, useState } from "react";
import type { Project } from "../types";

const LINKS = [
  ["01", "Workspace", "/workspace"],
  ["02", "Ingestion", "/ingestion"],
  ["03", "Dependency map", "/dependency-map"],
  ["04", "Intent summaries", "/intent-summaries"],
  ["05", "Expert review", "/intent-review"],
  ["06", "Discrepancies", "/discrepancies"],
];

export function AppShell() {
  const { user } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    let stop = false;
    const tick = () => {
      api<Project>(`/api/v1/projects/${projectId}`).then((result) => {
        if (!stop) setProject(result);
      }).catch(() => {
        if (!stop) setProject(null);
      });
    };
    tick();
    const timer = window.setInterval(tick, 2000);
    return () => { stop = true; window.clearInterval(timer); };
  }, [projectId]);

  async function signOut() {
    await api("/api/v1/auth/logout", { method: "POST" });
    navigate("/");
    window.location.assign("/");
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#content">Skip to content</a>
      <aside className="sidebar">
        <p className="wordmark">MoltProtocol <span>Intent workbench</span></p>
        <nav className="nav" aria-label="Workbench">
          {LINKS.map(([index, label, path]) => {
            const href = projectId && path !== "/workspace" ? `${path}/${projectId}` : path;
            return (
              <NavLink key={path} to={href}>
                <small>{index}</small>
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>
        <button type="button" className="secondary signout" onClick={() => void signOut()}>Sign out</button>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <p>{project ? project.name : "No project selected"}</p>
            {project && (
              <p className="identity">
                Ingestion <StatusBadge status={project.ingestionStatus} /> Analysis <StatusBadge status={project.analysisStatus} />
              </p>
            )}
          </div>
          <p className="identity">
            Signed in as {user?.displayName} · {user?.identityLabel}
          </p>
        </header>
        <main id="content" className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
