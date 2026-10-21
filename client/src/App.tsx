import { Navigate, Route, Routes } from "react-router-dom";
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
import { ReportsPage } from "./pages/ReportsPage";
import { ReviewPage } from "./pages/ReviewPage";
import { RuleCheckPage } from "./pages/RuleCheckPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TraceabilityPage } from "./pages/TraceabilityPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { AppShell } from "./shell/AppShell";

function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="content"><Skeleton lines={4} /><p className="visually-hidden">Checking session…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard/:projectId?" element={<DashboardPage />} />
        <Route path="/workspace/:projectId?" element={<WorkspacePage />} />
        <Route path="/ingestion/:projectId?" element={<IngestionPage />} />
        <Route path="/progress/:projectId?" element={<ProgressPage />} />
        <Route path="/dependency-map/:projectId?" element={<DependencyPage />} />
        <Route path="/intent-summaries/:projectId?" element={<IntentPage />} />
        <Route path="/intent-review/:projectId?" element={<ReviewPage />} />
        <Route path="/discrepancies/:projectId?" element={<DiscrepancyPage />} />
        <Route path="/rule-check/:projectId?" element={<RuleCheckPage />} />
        <Route path="/architecture/:projectId?" element={<ArchitecturePage />} />
        <Route path="/behavior/:projectId?" element={<BehaviorPage />} />
        <Route path="/traceability/:projectId?" element={<TraceabilityPage />} />
        <Route path="/reports/:projectId?" element={<ReportsPage />} />
        <Route path="/settings/:projectId?" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
