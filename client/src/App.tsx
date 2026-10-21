import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { IngestionPage } from "./pages/IngestionPage";
import { DependencyPage } from "./pages/DependencyPage";
import { IntentPage } from "./pages/IntentPage";
import { ReviewPage } from "./pages/ReviewPage";
import { DiscrepancyPage } from "./pages/DiscrepancyPage";
import { AppShell } from "./shell/AppShell";

function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="content" aria-live="polite">Checking session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/ingestion/:projectId?" element={<IngestionPage />} />
        <Route path="/dependency-map/:projectId?" element={<DependencyPage />} />
        <Route path="/intent-summaries/:projectId?" element={<IntentPage />} />
        <Route path="/intent-review/:projectId?" element={<ReviewPage />} />
        <Route path="/discrepancies/:projectId?" element={<DiscrepancyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
