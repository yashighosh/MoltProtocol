import type {
  CaseResult,
  ExecutionSummary,
  JobView,
  LeadershipModule,
  LeadershipOverview,
  Page,
  ProposalDetail,
  ProposalSummary,
  RuleCheck,
  RuleRow,
  RuleTrace,
  SuiteDetail,
} from "./contracts";
import { endpoints, readJson } from "./client";

function query(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

export function listProposals(projectId: string) {
  return readJson<Page<ProposalSummary>>(endpoints.proposals(projectId));
}

export function getProposal(projectId: string, proposalId: string) {
  return readJson<ProposalDetail>(endpoints.proposal(projectId, proposalId));
}

export function createProposal(projectId: string, name: string) {
  return readJson<{ proposalId: string; jobId: string; runId?: string }>(endpoints.proposals(projectId), {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export type EditOperation =
  | { op: "rename_component"; componentKey: string; name: string }
  | { op: "set_kind"; componentKey: string; kind: string }
  | { op: "move_module"; moduleId: string; toComponentKey: string; rationale: string };

export function saveProposalEdits(projectId: string, proposalId: string, body: { baseVersion: number; changeNote: string; operations: EditOperation[] }) {
  return readJson<ProposalDetail>(endpoints.proposalEdits(projectId, proposalId), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listRules(projectId: string, params: { status?: string; q?: string }) {
  return readJson<Page<RuleRow>>(query(endpoints.rules(projectId), params));
}

export function listComplianceRules(projectId: string, params: { status?: string; q?: string; moduleId?: string }) {
  return readJson<Page<RuleRow>>(query(endpoints.complianceRules(projectId), params));
}

export function getRuleTrace(projectId: string, ruleId: string) {
  return readJson<RuleTrace>(endpoints.ruleTrace(projectId, ruleId));
}

export function recordDecision(projectId: string, ruleId: string, body: { status: string; justification?: string; expectedRuleVersionId?: string }) {
  return readJson<RuleTrace>(endpoints.decision(projectId, ruleId), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listRuleChecks(projectId: string) {
  return readJson<Page<{ id: string; label: string; stale: boolean }>>(endpoints.ruleChecks(projectId));
}

export function getRuleCheck(projectId: string, runId: string) {
  return readJson<RuleCheck>(endpoints.ruleCheck(projectId, runId));
}

export function startRuleCheck(projectId: string, architectureVersionId: string) {
  return readJson<{ runId?: string; jobId?: string; reused?: boolean }>(endpoints.ruleChecks(projectId), {
    method: "POST",
    body: JSON.stringify({ architectureVersionId }),
  });
}

export function listSuites(projectId: string) {
  return readJson<Page<{ id: string; name: string }>>(endpoints.suites(projectId));
}

export function getSuite(projectId: string, suiteId: string) {
  return readJson<SuiteDetail>(endpoints.suite(projectId, suiteId));
}

export function startExecution(projectId: string, suiteId: string) {
  return readJson<{ executionId: string; jobId: string }>(endpoints.executions(projectId, suiteId), { method: "POST", body: "{}" });
}

export function getExecution(projectId: string, executionId: string) {
  return readJson<{ summary: ExecutionSummary; results: CaseResult[] }>(endpoints.execution(projectId, executionId));
}

export function getLeadership(projectId: string) {
  return readJson<LeadershipOverview>(endpoints.leadership(projectId));
}

export function listLeadershipModules(projectId: string, params: { sort?: string; dir?: string; band?: string; verified?: string; q?: string }) {
  return readJson<Page<LeadershipModule>>(query(endpoints.leadershipModules(projectId), params));
}

export function getJob(projectId: string, jobId: string) {
  return readJson<JobView>(endpoints.job(projectId, jobId));
}
