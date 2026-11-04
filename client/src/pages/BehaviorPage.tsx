import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api";
import { DiffView } from "../components/DiffView";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { JobStatus } from "../components/JobStatus";
import { PageHeader } from "../components/PageHeader";
import { PendingData } from "../components/PendingData";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import type { CaseResult } from "../connection/contracts";
import { getExecution, getSuite, listSuites, startExecution } from "../connection/modernize";
import { shownCount, useLoad } from "../hooks/useLoad";

const OUTCOME_LABEL = {
  pass: "Pass",
  fail: "Fail",
  error: "Error",
  never_run: "Never run",
} as const;

export function BehaviorPage() {
  const { projectId, suiteId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const suites = useLoad(() => listSuites(projectId!), [projectId]);
  const suite = useLoad(() => (suiteId ? getSuite(projectId!, suiteId) : Promise.resolve(null)), [projectId, suiteId]);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const execution = useLoad(() => (executionId ? getExecution(projectId!, executionId) : Promise.resolve(null)), [projectId, executionId]);

  async function run() {
    if (!projectId || !suiteId) return;
    setActionError("");
    try {
      const started = await startExecution(projectId, suiteId);
      setExecutionId(started.executionId);
      setJobId(started.jobId);
      toast("Comparison started.");
    } catch (reason) {
      setActionError(reason instanceof ApiError ? reason.message : "A run needs the database connection and two configured endpoints.");
    }
  }

  if (!projectId) return <EmptyState title="Open a project first"><Link to="/workspace">Open projects</Link></EmptyState>;

  const suiteData = suite.state.kind === "ready" ? suite.state.data : null;
  const result = execution.state.kind === "ready" ? execution.state.data : null;
  const selected: CaseResult | undefined = result?.results.find((item) => item.id === picked);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Preview"
        title="Behavior testing"
        lede="Runtime comparison of endpoints you configured. The same request is sent to the legacy endpoint and the modernized endpoint. Uploaded code is not executed."
        actions={<button type="button" onClick={() => void run()} disabled={!suiteId}>Run comparison</button>}
      />
      <JobStatus projectId={projectId} jobId={jobId} />
      {actionError && <ErrorState message={actionError} />}
      {suites.state.kind === "loading" && <Skeleton lines={4} />}
      {suites.state.kind === "error" && <ErrorState message={suites.state.message} onRetry={suites.reload} />}
      {suites.state.kind === "disconnected" && (
        <EmptyState title="Configured endpoints are required">
          Add a legacy endpoint and a modernized endpoint after the database is connected. Until then this console stays empty. A missing endpoint is an error, not a pass.
        </EmptyState>
      )}
      {suites.state.kind === "ready" && (
        <div className="behavior-console">
          <aside className="card stack-tight" aria-label="Suites and cases">
            <h2>Suites</h2>
            {suites.state.data.items.length === 0 && <p>No suite is stored.</p>}
            {suites.state.data.items.map((item) => (
              <button key={item.id} type="button" className="secondary" onClick={() => navigate(`/behavior/${projectId}/${item.id}`)}>{item.name}</button>
            ))}
            <h2>Cases</h2>
            {(suiteData?.cases ?? []).map((item) => (
              <p key={item.id} className={`outcome-${item.outcome}`}>
                {OUTCOME_LABEL[item.outcome]} · {item.name}
              </p>
            ))}
          </aside>
          <section className="card stack" aria-label="Results">
            {!suiteId && <EmptyState title="Choose a suite">The case list and results open here.</EmptyState>}
            {suiteId && suite.state.kind === "loading" && <Skeleton />}
            {suiteId && suite.state.kind === "disconnected" && <PendingData title="This suite is not available yet" />}
            {suiteData && <p>Legacy: {suiteData.legacy?.name ?? "Not configured"}. Modernized: {suiteData.modernized?.name ?? "Not configured"}.</p>}
            {result?.summary && (
              <p className="callout" role="status">
                Passed {shownCount(result.summary.passed)}, failed {shownCount(result.summary.failed)}, errored {shownCount(result.summary.errored)}.
                Pass rate {result.summary.passRate == null ? "not assessed" : `${result.summary.passRate}%`}.
                {result.summary.finishedAt ? ` Finished ${result.summary.finishedAt}.` : ""}
              </p>
            )}
            {result?.results.map((item) => (
              <button key={item.id} type="button" className="secondary" onClick={() => setPicked(item.id)}>
                <span className={`outcome-${item.outcome}`}>{OUTCOME_LABEL[item.outcome]}</span> {item.name}
              </button>
            ))}
            {selected?.outcome === "error" && <p role="alert">Error: {selected.errorSide ?? "endpoint"} unreachable. {selected.errorDetail ?? "No further detail stored."}</p>}
            {selected && selected.outcome !== "error" && (
              <DiffView legacy={selected.legacyBody} modernized={selected.modernizedBody} entries={selected.diff} />
            )}
          </section>
          <aside className="card stack" aria-label="Run console">
            <h2>Run console</h2>
            <p>History and pass rate across runs will list here when executions are stored.</p>
            {!executionId && <p className="muted">No run has been requested in this session.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
