import { ApiError } from "../api";

/** Thrown when a modernization route is not served yet. Screens must not invent records. */
export class DisconnectedError extends Error {
  constructor() {
    super("This screen is waiting for the database connection. No figures are shown until records are available.");
    this.name = "DisconnectedError";
  }
}

/**
 * Paths the website calls. Change only this map when the database-backed API is ready.
 * The browser never opens a database itself.
 */
export const endpoints = {
  proposals: (projectId: string) => `/api/v1/projects/${projectId}/architecture/proposals`,
  proposal: (projectId: string, proposalId: string) => `/api/v1/projects/${projectId}/architecture/proposals/${proposalId}`,
  proposalEdits: (projectId: string, proposalId: string) => `/api/v1/projects/${projectId}/architecture/proposals/${proposalId}/edits`,
  rules: (projectId: string) => `/api/v1/projects/${projectId}/rules`,
  rule: (projectId: string, ruleId: string) => `/api/v1/projects/${projectId}/rules/${ruleId}`,
  ruleTrace: (projectId: string, ruleId: string) => `/api/v1/projects/${projectId}/compliance/rules/${ruleId}/trace`,
  complianceRules: (projectId: string) => `/api/v1/projects/${projectId}/compliance/rules`,
  decision: (projectId: string, ruleId: string) => `/api/v1/projects/${projectId}/compliance/rules/${ruleId}/decisions`,
  ruleChecks: (projectId: string) => `/api/v1/projects/${projectId}/rule-checks`,
  ruleCheck: (projectId: string, runId: string) => `/api/v1/projects/${projectId}/rule-checks/${runId}`,
  suites: (projectId: string) => `/api/v1/projects/${projectId}/test-suites`,
  suite: (projectId: string, suiteId: string) => `/api/v1/projects/${projectId}/test-suites/${suiteId}`,
  executions: (projectId: string, suiteId: string) => `/api/v1/projects/${projectId}/test-suites/${suiteId}/executions`,
  execution: (projectId: string, executionId: string) => `/api/v1/projects/${projectId}/executions/${executionId}`,
  leadership: (projectId: string) => `/api/v1/projects/${projectId}/leadership/overview`,
  leadershipModules: (projectId: string) => `/api/v1/projects/${projectId}/leadership/modules`,
  job: (projectId: string, jobId: string) => `/api/v1/projects/${projectId}/jobs/${jobId}`,
};

export async function readJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  const body = (data && typeof data === "object" ? data : {}) as { error?: { code?: string; message?: string; requestId?: string } };
  if (response.status === 404 && !body.error) throw new DisconnectedError();
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? "REQUEST_FAILED",
      body.error?.message ?? "Request failed",
      {},
    );
  }
  return data as T;
}
