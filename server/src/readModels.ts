import { all, one, type AppDatabase } from "./db.js";
import { discrepancyPayload, requireProject, summariesPayload } from "./pipeline.js";

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dashboardPayload(db: AppDatabase, projectId?: string) {
  if (projectId) requireProject(db, projectId);
  const clause = projectId ? "project_id = ?" : "1 = 1";
  const args = projectId ? [projectId] : [];
  const moduleRow = one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM modules WHERE kind = 'file' AND ${clause}`, ...args);
  const summaryRow = one<{
    summaries: number;
    validated: number;
    at_risk: number;
    low: number;
    medium: number;
    high: number;
  }>(
    db,
    `SELECT
      COUNT(*) AS summaries,
      COALESCE(SUM(CASE WHEN status IN ('confirmed', 'corrected') THEN 1 ELSE 0 END), 0) AS validated,
      COALESCE(SUM(CASE WHEN confidence = 'low' OR source_drift = 1 THEN 1 ELSE 0 END), 0) AS at_risk,
      COALESCE(SUM(CASE WHEN confidence = 'low' THEN 1 ELSE 0 END), 0) AS low,
      COALESCE(SUM(CASE WHEN confidence = 'medium' THEN 1 ELSE 0 END), 0) AS medium,
      COALESCE(SUM(CASE WHEN confidence = 'high' THEN 1 ELSE 0 END), 0) AS high
     FROM intent_summaries WHERE ${clause}`,
    ...args,
  );
  const discrepancyRow = one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM discrepancies WHERE ${clause}`, ...args);
  const clusters = all<{ directory: string; modules: number; low: number }>(
    db,
    `SELECT m.directory AS directory,
            COUNT(DISTINCT m.id) AS modules,
            COALESCE(SUM(CASE WHEN s.confidence = 'low' THEN 1 ELSE 0 END), 0) AS low
     FROM modules m
     LEFT JOIN intent_summaries s ON s.module_id = m.id
     WHERE m.kind = 'file' AND ${projectId ? "m.project_id = ?" : "1 = 1"}
     GROUP BY m.directory
     ORDER BY modules DESC, directory`,
    ...args,
  );
  const events = all<{ at: string; label: string; detail: string | null }>(
    db,
    `SELECT created_at AS at, stage AS label, detail
     FROM ingestion_events
     WHERE ${clause}
     ORDER BY created_at DESC
     LIMIT 8`,
    ...args,
  );
  const revisions = all<{ at: string; label: string; detail: string | null }>(
    db,
    `SELECT r.created_at AS at, r.action AS label, m.name AS detail
     FROM intent_revisions r
     JOIN intent_summaries s ON s.id = r.summary_id
     JOIN modules m ON m.id = s.module_id
     WHERE ${projectId ? "s.project_id = ?" : "1 = 1"}
     ORDER BY r.created_at DESC
     LIMIT 8`,
    ...args,
  );
  const project = projectId
    ? one<{ name: string; ingestion_status: string; analysis_status: string; summary_status: string; discrepancy_status: string }>(
      db,
      "SELECT name, ingestion_status, analysis_status, summary_status, discrepancy_status FROM projects WHERE id = ?",
      projectId,
    )
    : undefined;
  const statuses = {
    ingestion: project?.ingestion_status ?? "not_started",
    analysis: project?.analysis_status ?? "not_started",
    summary: project?.summary_status ?? "not_started",
    discrepancy: project?.discrepancy_status ?? "not_started",
  };
  const complete = Object.values(statuses).filter((status) => status === "complete").length;
  return {
    projectId: projectId ?? null,
    projectName: project?.name ?? null,
    modulesParsed: num(moduleRow?.n),
    intentSummaries: num(summaryRow?.summaries),
    validatedByExperts: num(summaryRow?.validated),
    atRisk: num(summaryRow?.at_risk),
    discrepancies: num(discrepancyRow?.n),
    confidence: {
      low: num(summaryRow?.low),
      medium: num(summaryRow?.medium),
      high: num(summaryRow?.high),
    },
    clusters: clusters.map((cluster) => ({
      directory: cluster.directory,
      modules: num(cluster.modules),
      low: num(cluster.low),
    })),
    activity: [...events, ...revisions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10),
    stageProgress: projectId ? complete / 4 : null,
    statuses: projectId ? statuses : null,
  };
}

export function traceabilityPayload(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  const summaries = summariesPayload(db, projectId).summaries;
  const discrepancies = discrepancyPayload(db, projectId).items;
  const files = all<{ path: string; status: string; rejection_reason: string | null }>(
    db,
    "SELECT path, status, rejection_reason FROM ingested_files WHERE project_id = ? ORDER BY path",
    projectId,
  );
  const covered = new Set<string>();
  const rows: {
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
  }[] = [];

  for (const summary of summaries) {
    const related = discrepancies.filter((item) => item.moduleId === summary.moduleId);
    const evidence = summary.evidence.length > 0
      ? summary.evidence
      : [{ path: summary.moduleName ?? "", startLine: 1, endLine: 1, reason: "Module file" }];
    for (const item of evidence) {
      covered.add(item.path);
      rows.push({
        path: item.path,
        startLine: item.startLine,
        endLine: item.endLine,
        moduleName: summary.moduleName ?? null,
        intentText: summary.text,
        reviewStatus: summary.status,
        reviewerName: summary.reviewerName,
        identityLabel: summary.identityLabel,
        reviewedAt: summary.reviewedAt,
        discrepancy: related.length > 0 ? related.map((itemRow) => itemRow.ruleId).join(", ") : null,
        summaryId: summary.id,
        note: item.reason,
      });
    }
  }

  for (const file of files) {
    if (covered.has(file.path)) continue;
    rows.push({
      path: file.path,
      startLine: null,
      endLine: null,
      moduleName: null,
      intentText: null,
      reviewStatus: file.status,
      reviewerName: null,
      identityLabel: null,
      reviewedAt: null,
      discrepancy: null,
      summaryId: null,
      note: file.rejection_reason,
    });
  }

  return { projectId: project.id, projectName: project.name, rows };
}
