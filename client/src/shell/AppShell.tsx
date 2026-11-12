import {
  BadgeCheck, FileSearch, FolderKanban, GitCompare, LayoutDashboard, ListChecks,
  LogOut, Menu, Moon, PanelLeft, Scale, ScrollText, Search, Settings, Share2, Shield, Sun, Upload, Workflow,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { CommandPalette } from "../components/CommandPalette";
import { Logo } from "../components/Logo";
import { NotificationBell, watchProject, type Notice } from "../components/NotificationBell";
import type { Project } from "../types";
import { setTravel } from "../travel";

const GROUPS = [
  { label: "Overview", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tag: "" },
    { to: "/workspace", label: "Projects", icon: FolderKanban, tag: "" },
  ]},
  { label: "Analysis", items: [
    { to: "/ingestion", label: "Ingest", icon: Upload, tag: "" },
    { to: "/progress", label: "Progress", icon: ListChecks, tag: "" },
    { to: "/dependency-map", label: "Dependency map", icon: Share2, tag: "" },
  ]},
  { label: "Intent", items: [
    { to: "/intent-summaries", label: "Intent summaries", icon: FileSearch, tag: "" },
    { to: "/rules", label: "Rules", icon: Scale, tag: "Preview" },
  ]},
  { label: "Review", items: [
    { to: "/intent-review", label: "Expert review", icon: BadgeCheck, tag: "" },
    { to: "/discrepancies", label: "Discrepancies", icon: GitCompare, tag: "" },
  ]},
  { label: "Modernize", items: [
    { to: "/architecture", label: "Architecture", icon: Workflow, tag: "Preview" },
    { to: "/rule-check", label: "Rule preservation", icon: Shield, tag: "Preview" },
    { to: "/behavior", label: "Behavior testing", icon: ListChecks, tag: "Preview" },
  ]},
  { label: "Output", items: [
    { to: "/traceability", label: "Compliance and traceability", icon: ScrollText, tag: "" },
    { to: "/leadership", label: "Leadership view", icon: LayoutDashboard, tag: "Preview" },
    { to: "/reports", label: "Reports", icon: FileSearch, tag: "" },
  ]},
  { label: "Settings", items: [
    { to: "/settings", label: "Settings", icon: Settings, tag: "" },
  ]},
];

const NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  workspace: "Projects",
  ingestion: "Ingest",
  progress: "Progress",
  "dependency-map": "Dependency map",
  "intent-summaries": "Intent summaries",
  rules: "Rules",
  "intent-review": "Expert review",
  discrepancies: "Discrepancies",
  "rule-check": "Rule preservation",
  architecture: "Architecture",
  behavior: "Behavior testing",
  traceability: "Compliance and traceability",
  leadership: "Leadership view",
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
  const [theme, setTheme] = useState(localStorage.getItem("moltprotocol-theme") === "dark" ? "dark" : "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("moltprotocol-theme", theme);
  }, [theme]);

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
      <aside className={`sidebar on-dark${menuOpen ? " open" : ""}`}>
        <Logo compact={collapsed} inverse size={26} />
        <nav aria-label="Workbench">
          {GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const to = hrefFor(item.to, projectId);
                return (
                  <NavLink
                    key={item.to}
                    viewTransition
                    className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                    to={to}
                    title={item.label}
                    onClick={() => { setMenuOpen(false); setTravel(location.pathname, to); }}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId="nav-marker" className="nav-marker" transition={{ duration: 0.2, ease: "easeOut" }} />}
                        <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                        <span className="label">{item.label}</span>
                        {item.tag === "Preview" && <span className="nav-preview">Preview</span>}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <p className="identity-note">
            <span aria-hidden="true">{(user?.displayName?.trim().split(/\s+/)[0]?.[0] ?? "?").toUpperCase()}</span>
            <span><strong>{user?.displayName ?? "Signed in"}</strong><span>{user?.identityLabel ?? "Demo identity"}</span></span>
          </p>
          <button type="button" className="side-action" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSidebar}>
            <PanelLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
          <button type="button" className="side-action" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}>
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn chrome-control" aria-label="Open navigation" onClick={() => setMenuOpen((value) => !value)}><Menu size={16} strokeWidth={1.75} /></button>
          <div className="grow stack" style={{ gap: 2 }}>
            <Breadcrumbs items={crumbs} />
          </div>
          <div className="topbar-actions">
            <label className="visually-hidden" htmlFor="project-switch">Project</label>
            <select id="project-switch" className="chrome-control" aria-label="Project" value={projectId ?? ""} onChange={(event) => {
              const next = event.target.value;
              const base = `/${section}`;
              const to = next ? hrefFor(base, next) : base;
              setTravel(location.pathname, to);
              navigate(to, { viewTransition: true });
            }}>
              <option value="">No project selected</option>
              {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <div className="tool-tray">
              <button type="button" className="icon-btn chrome-control" aria-label="Search" onClick={() => setPalette(true)}>
                <Search size={16} strokeWidth={1.75} />
              </button>
              <NotificationBell notices={notices} />
              <button
                type="button"
                className="icon-btn chrome-control"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
              </button>
            </div>
            <button
              type="button"
              className="avatar chrome-control"
              aria-label={`Signed in as ${user?.displayName ?? "user"}, ${user?.identityLabel ?? "signed-in identity"}`}
              title={`${user?.displayName ?? "Signed in"} · ${user?.identityLabel ?? ""}`}
            >
              {(user?.displayName?.trim().split(/\s+/)[0]?.[0] ?? "?").toUpperCase()}
            </button>
          </div>
        </header>
        <main id="content" className={`content${["dashboard", "architecture", "rule-check", "behavior", "traceability", "leadership", "rules", "dependency-map"].includes(section) ? " wide" : ""}`}>
          <Outlet />
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
