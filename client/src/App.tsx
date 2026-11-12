import { createBrowserRouter, Link, Navigate, RouterProvider } from "react-router-dom";
import { useAuth } from "./auth";
import { Skeleton } from "./components/Skeleton";
import { ArchitecturePage } from "./pages/ArchitecturePage";
import { BehaviorPage } from "./pages/BehaviorPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DependencyPage } from "./pages/DependencyPage";
import { DiscrepancyPage } from "./pages/DiscrepancyPage";
import { IngestionPage } from "./pages/IngestionPage";
import { IntentPage } from "./pages/IntentPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ProgressPage } from "./pages/ProgressPage";
import { LeadershipPage } from "./pages/LeadershipPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ReviewPage } from "./pages/ReviewPage";
import { RuleCheckPage } from "./pages/RuleCheckPage";
import { RulesPage } from "./pages/RulesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TraceabilityPage } from "./pages/TraceabilityPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { EmptyState } from "./components/EmptyState";
import { AppShell } from "./shell/AppShell";

function NotFound() {
  return (
    <main className="content">
      <EmptyState title="This page is not in the workbench">
        <Link to="/">Back to the introduction</Link>
      </EmptyState>
    </main>
  );
}

function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="content"><Skeleton lines={4} /><p className="visually-hidden">Checking session…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/dashboard/:projectId?", element: <DashboardPage /> },
      { path: "/workspace/:projectId?", element: <WorkspacePage /> },
      { path: "/ingestion/:projectId?", element: <IngestionPage /> },
      { path: "/progress/:projectId?", element: <ProgressPage /> },
      { path: "/dependency-map/:projectId?", element: <DependencyPage /> },
      { path: "/intent-summaries/:projectId?", element: <IntentPage /> },
      { path: "/rules/:projectId?", element: <RulesPage /> },
      { path: "/intent-review/:projectId?", element: <ReviewPage /> },
      { path: "/discrepancies/:projectId?", element: <DiscrepancyPage /> },
      { path: "/rule-check/:projectId?/:runId?", element: <RuleCheckPage /> },
      { path: "/architecture/:projectId?/:proposalId?", element: <ArchitecturePage /> },
      { path: "/behavior/:projectId?/:suiteId?", element: <BehaviorPage /> },
      { path: "/traceability/:projectId?/:ruleId?", element: <TraceabilityPage /> },
      { path: "/leadership/:projectId?", element: <LeadershipPage /> },
      { path: "/reports/:projectId?", element: <ReportsPage /> },
      { path: "/settings/:projectId?", element: <SettingsPage /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
