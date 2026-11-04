/**
 * Response shapes the website expects.
 * When the database is connected, keep these fields or map them in data/modernize.ts.
 * Missing values stay null. The screens show "Not assessed" and never substitute zero.
 */

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  total?: number | null;
};

export type ProposalSummary = {
  id: string;
  name: string;
  status: string;
  version: number | null;
};

export type ArchComponent = {
  id: string;
  componentKey: string;
  name: string;
  kind: string;
  description: string | null;
  boundaryRationale: string;
};

export type ArchMapping = {
  id: string;
  componentId: string;
  moduleId: string;
  moduleName: string;
  rationale: string;
  intentText: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewHref: string | null;
};

export type ArchRelationship = {
  id: string;
  fromComponentId: string;
  toComponentId: string;
  kind: string;
  derivedEdgeCount: number | null;
};

export type ArchResponsibility = {
  id: string;
  componentId: string;
  statement: string;
  ruleKey: string | null;
  affirmed: boolean;
};

export type ArchScope = {
  moduleId: string;
  moduleName: string;
  state: string;
  reason: string | null;
};

export type ProposalDetail = {
  proposal: ProposalSummary;
  version: { id: string; version: number; origin: string; changeNote: string | null };
  scope: ArchScope[];
  components: ArchComponent[];
  mappings: ArchMapping[];
  relationships: ArchRelationship[];
  responsibilities: ArchResponsibility[];
  staleReason: string | null;
};

export type RuleRow = {
  id: string;
  ruleKey: string;
  statement: string;
  status: string;
  moduleId: string | null;
  moduleName: string | null;
  counted: boolean;
};

export type RuleTrace = {
  rule: RuleRow;
  legacy: { path: string | null; lines: string | null; snippet: string | null; drifted: boolean | null };
  intent: { text: string | null; revision: string | null; reviewer: string | null; reviewedAt: string | null; note: string | null };
  architecture: { componentKey: string | null; componentName: string | null; version: string | null; coverage: string | null; stale: boolean | null };
  migration: { status: string; justification: string | null; decidedBy: string | null; decidedAt: string | null; versionNote: string | null };
  history: { id: string; status: string; justification: string | null; decidedBy: string | null; decidedAt: string | null }[];
  suggestion: string | null;
};

export type CoverageCounts = {
  preserved: number | null;
  mentionedOnly: number | null;
  distorted: number | null;
  dropped: number | null;
  retired: number | null;
  notInScope: number | null;
};

export type CoverageRow = {
  id: string;
  ruleId: string;
  ruleKey: string;
  statement: string;
  status: string;
  componentKey: string | null;
  componentName: string | null;
  reason: string | null;
  responsibility: string | null;
  sourcePath: string | null;
};

export type RuleCheck = {
  runId: string;
  architectureLabel: string;
  architectureVersionId: string;
  stale: boolean;
  staleReason: string | null;
  counts: CoverageCounts;
  rows: CoverageRow[];
};

export type EndpointConfig = {
  id: string;
  role: "legacy" | "modernized";
  name: string;
  baseUrl: string;
};

export type TestCaseRow = {
  id: string;
  name: string;
  method: string;
  path: string;
  outcome: "pass" | "fail" | "error" | "never_run";
  errorDetail: string | null;
  ruleKey: string | null;
};

export type DiffEntry = {
  path: string;
  kind: string;
  legacy: string | null;
  modernized: string | null;
};

export type SuiteDetail = {
  id: string;
  name: string;
  legacy: EndpointConfig | null;
  modernized: EndpointConfig | null;
  cases: TestCaseRow[];
};

export type ExecutionSummary = {
  id: string;
  status: string;
  passed: number | null;
  failed: number | null;
  errored: number | null;
  passRate: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: string | null;
  legacyName: string | null;
  modernizedName: string | null;
};

export type CaseResult = {
  id: string;
  caseId: string;
  name: string;
  outcome: "pass" | "fail" | "error";
  errorSide: string | null;
  errorDetail: string | null;
  legacyBody: string | null;
  modernizedBody: string | null;
  diff: DiffEntry[];
};

export type LeadershipOverview = {
  asOf: string | null;
  narrative: string | null;
  verified: number | null;
  unexamined: number | null;
  notAnalyzable: number | null;
  highRisk: number | null;
  behaviorLine: string | null;
  rulesLine: string | null;
};

export type LeadershipModule = {
  id: string;
  name: string;
  path: string | null;
  loc: number | null;
  verified: boolean | null;
  band: "low" | "medium" | "high" | "not_assessed";
  reasons: string[];
};

export type JobView = {
  id: string;
  status: string;
  error: string | null;
};
