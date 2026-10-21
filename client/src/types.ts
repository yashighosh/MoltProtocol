export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  isDemo: boolean;
  identityLabel: string;
};

export type ProjectFile = {
  id: string;
  path: string;
  language: string | null;
  loc: number | null;
  status: string;
  rejectionReason: string | null;
};

export type Project = {
  id: string;
  name: string;
  sourceType: string;
  sourceRef: string | null;
  ingestionStatus: string;
  ingestionStage: string;
  ingestionError: string | null;
  analysisStatus: string;
  analysisError: string | null;
  summaryStatus: string;
  summaryError: string | null;
  summaryMode: string;
  discrepancyStatus: string;
  discrepancyError: string | null;
  excludedUnreviewed: number;
  createdAt: string;
  updatedAt: string;
  stages: { stage: string; detail: string | null; createdAt: string }[];
  summary: {
    fileCount: number;
    parsedCount: number;
    rejectedCount: number;
    languages: { language: string; files: number; loc: number }[];
    totalLoc: number;
  };
  files: ProjectFile[];
  reviewQueued: number;
  reviewValidated: number;
};

export type GraphNode = {
  id: string;
  name: string;
  kind: string;
  directory: string;
  resolution: string;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  relationship: string;
  resolution: string;
  detail: string | null;
};

export type Evidence = { path: string; startLine: number; endLine: number; reason: string };

export type IntentSummary = {
  id: string;
  projectId: string;
  moduleId: string;
  moduleName: string;
  text: string;
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  rationale: Record<string, number>;
  evidence: Evidence[];
  mode: string;
  status: string;
  queuedForReview: boolean;
  reviewerName: string | null;
  reviewedAt: string | null;
  identityLabel: string | null;
  sourceDrift: boolean;
  generatedAt: string;
  revisions?: { version: number; text: string; action: string; createdAt: string; reviewerName: string | null; identityLabel: string | null }[];
};

export type DashboardData = {
  projectId: string | null;
  projectName: string | null;
  modulesParsed: number;
  intentSummaries: number;
  validatedByExperts: number;
  atRisk: number;
  discrepancies: number;
  confidence: { low: number; medium: number; high: number };
  clusters: { directory: string; modules: number; low: number }[];
  activity: { at: string; label: string; detail: string | null }[];
  stageProgress: number | null;
  statuses: { ingestion: string; analysis: string; summary: string; discrepancy: string } | null;
};

export type TraceRow = {
  path: string;
  startLine: number | null;
  endLine: number | null;
  moduleName: string | null;
  intentText: string | null;
  reviewStatus: string;
  reviewerName: string | null;
  identityLabel: string | null;
  reviewedAt: string | null;
  discrepancy: string | null;
  summaryId: string | null;
  note: string | null;
};

export type Discrepancy = {
  id: string;
  moduleId: string;
  moduleName: string;
  summaryId: string;
  ruleId: string;
  description: string;
  codeExcerpt: string;
  intentText: string;
  startLine: number;
  endLine: number;
  severity: string;
  impactScore: number;
  impactRank: number;
  factors: Record<string, number>;
  status: string;
};
