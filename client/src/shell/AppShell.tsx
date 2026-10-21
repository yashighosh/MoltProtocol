import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, FileSearch, FolderKanban, GitCompare, LayoutDashboard, ListChecks,
  Menu, ScrollText, Settings, Share2, Shield, Upload, Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { CommandPalette } from "../components/CommandPalette";
import { Logo } from "../components/Logo";
import { NotificationBell, watchProject, type Notice } from "../components/NotificationBell";
import type { Project } from "../types";

const GROUPS = [
  { label: "Overview", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tag: "Live" },
    { to: "/workspace", label: "Projects", icon: FolderKanban, tag: "Live" },
  ]},
  { label: "Analysis", items: [
    { to: "/ingestion", label: "Ingest", icon: Upload, tag: "Live" },
    { to: "/progress", label: "Progress", icon: ListChecks, tag: "Live" },
    { to: "/dependency-map", label: "Dependency map", icon: Share2, tag: "Live" },
  ]},
  { label: "Intent", items: [
    { to: "/intent-summaries", label: "Intent summaries", icon: FileSearch, tag: "Live" },
  ]},
  { label: "Review", items: [
    { to: "/intent-review", label: "Expert review", icon: BadgeCheck, tag: "Live" },
    { to: "/discrepancies", label: "Discrepancies", icon: GitCompare, tag: "Live" },
  ]},
  { label: "Modernize", items: [
    { to: "/rule-check", label: "Rule check", icon: Shield, tag: "Live" },
    { to: "/architecture", label: "Architecture draft", icon: Workflow, tag: "Preview" },
    { to: "/behavior", label: "Behavior checks", icon: ListChecks, tag: "Preview" },
  ]},
  { label: "Output", items: [
    { to: "/traceability", label: "Traceability", icon: ScrollText, tag: "Live" },
    { to: "/reports", label: "Reports", icon: FileSearch, tag: "Live" },
  ]},
  { label: "Settings", items: [
    { to: "/settings", label: "Settings", icon: Settings, tag: "Live" },
  ]},
];

const NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  workspace: "Projects",
  ingestion: "Ingest",
  progress: "Progress",
  "dependency-map": "Dependency map",
  "intent-summaries": "Intent summaries",
  "intent-review": "Expert review",
  discrepancies: "Discrepancies",
  "rule-check": "Rule check",
  architecture: "Architecture draft",
  behavior: "Behavior checks",
  traceability: "Traceability",
  reports: "Reports",
  settings: "Settings",
};

function hrefFor(path: string, projectId?: string) {
  if (!projectId || path === "/workspace") return path;
  return `${path}/${projectId}`;
}

export function AppShell() {
  const { user, setUser } = useAuth();
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collapsed, setCollapsed] = useState(localStorage.getItem("moltprotocol-sidebar") === "1");
  const [menuOpen, setMenuOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [welcome, setWelcome] = useState(localStorage.getItem("moltprotocol-welcome-seen") !== "1");

  useEffect(() => {
    api<{ projects: Project[] }>("/api/v1/projects").then((result) => setProjects(result.projects)).catch(() => setProjects([]));
  }, [projectId, location.pathname]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    let stop = false;
    let timer = 0;
    let previous: Project | null = null;
    const tick = () => {
      api<Project>(`/api/v1/projects/${projectId}`).then((result) => {
        if (stop) return;
        setNotices((current) => [...watchProject(previous, result), ...current].slice(0, 12));
        previous = result;
        setProject(result);
      }).catch(() => { if (!stop) setProject(null); });
    };
    const start = () => {
      window.clearInterval(timer);
      if (document.hidden) return;
      tick();
      timer = window.setInterval(tick, 2000);
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      stop = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [projectId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    await api("/api/v1/auth/logout", { method: "POST" });
    setUser(null);
    navigate("/");
  }

  function toggleSidebar() {
    setCollapsed((value) => {
      localStorage.setItem("moltprotocol-sidebar", value ? "0" : "1");
      return !value;
    });
  }

  const section = location.pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const crumbs = [
    { label: "Workbench", to: "/dashboard" },
    ...(project ? [{ label: project.name, to: `/dashboard/${project.id}` }] : []),
    { label: NAMES[section] ?? "Page" },
  ];

  return (
    <div className={`shell${collapsed ? " collapsed" : ""}`}>
      <a className="skip-link" href="#content">Skip to content</a>
      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <Logo compact={collapsed} inverse />
        <nav aria-label="Workbench">
          {GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to={hrefFor(item.to, projectId)} onClick={() => setMenuOpen(false)}>
                    <Icon size={16} aria-hidden="true" />
                    <span className="label">{item.label}</span>
                    <span className={`tag${item.tag === "Live" ? " live" : ""}`}>{item.tag}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <button type="button" className="secondary" onClick={toggleSidebar}>{collapsed ? "Expand" : "Collapse"}</button>
          <button type="button" className="secondary" onClick={() => void signOut()}>Sign out</button>
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" aria-label="Open navigation" onClick={() => setMenuOpen((value) => !value)}><Menu size={16} /></button>
          <div className="grow stack" style={{ gap: 2 }}>
            <Breadcrumbs items={crumbs} />
          </div>
          <label className="visually-hidden" htmlFor="project-switch">Project</label>
          <select id="project-switch" aria-label="Project" value={projectId ?? ""} onChange={(event) => {
            const next = event.target.value;
            const base = `/${section}`;
            navigate(next ? hrefFor(base, next) : base);
          }}>
            <option value="">No project selected</option>
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="button" className="secondary" onClick={() => setPalette(true)}>Search</button>
          <NotificationBell notices={notices} />
          <p className="identity-chip">Signed in as {user?.displayName} · {user?.identityLabel}</p>
        </header>
        <main id="content" className="content">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette projectId={projectId} open={palette} onClose={() => setPalette(false)} />
      {welcome && (
        <div className="dialog-backdrop">
          <div className="dialog onboard stack" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <h2 id="welcome-title">Three places to start</h2>
            <p>Inference is not sign-off. Read the code, get a named review, then look at the conflicts.</p>
            <div className="steps-3">
              <article className="card"><h3>Ingest</h3><p>Bring in the codebase. Flagged files stay visible.</p></article>
              <article className="card"><h3>Validate</h3><p>Confirm or correct an intent with this demo identity.</p></article>
              <article className="card"><h3>Compare</h3><p>See code and validated intent together.</p></article>
            </div>
            <button type="button" onClick={() => { localStorage.setItem("moltprotocol-welcome-seen", "1"); setWelcome(false); }}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
