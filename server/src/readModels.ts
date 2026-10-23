import { all, one, type AppDatabase } from "./db.js";
import { DEMO_SOURCE_REF, discrepancyPayload, requireProject, summariesPayload } from "./pipeline.js";

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
  const events = all<{ at: string; label: string; detail: string | null; actor: string | null }>(
    db,
    `SELECT created_at AS at, stage AS label, detail, NULL AS actor
     FROM ingestion_events
     WHERE ${clause}
     ORDER BY created_at DESC
     LIMIT 8`,
    ...args,
  );
  const revisions = all<{ at: string; label: string; detail: string | null; actor: string | null }>(
    db,
    `SELECT r.created_at AS at, r.action AS label, m.name AS detail, u.display_name AS actor
     FROM intent_revisions r
     JOIN intent_summaries s ON s.id = r.summary_id
     JOIN modules m ON m.id = s.module_id
     LEFT JOIN users u ON u.id = r.reviewer_id
     WHERE ${projectId ? "s.project_id = ?" : "1 = 1"}
     ORDER BY r.created_at DESC
     LIMIT 8`,
    ...args,
  );
  const project = projectId
    ? one<{
      name: string;
      source_ref: string | null;
      ingestion_status: string;
      analysis_status: string;
      summary_status: string;
      discrepancy_status: string;
      ingestion_error: string | null;
      analysis_error: string | null;
      summary_error: string | null;
      discrepancy_error: string | null;
      excluded_unreviewed: number;
    }>(
      db,
      `SELECT name, source_ref, ingestion_status, analysis_status, summary_status, discrepancy_status,
              ingestion_error, analysis_error, summary_error, discrepancy_error, excluded_unreviewed
       FROM projects WHERE id = ?`,
      projectId,
    )
    : undefined;
  const fileRow = projectId
    ? one<{ files: number; flagged: number; loc: number }>(
      db,
      `SELECT COUNT(*) AS files,
              COALESCE(SUM(CASE WHEN status != 'parsed' THEN 1 ELSE 0 END), 0) AS flagged,
              COALESCE(SUM(CASE WHEN status = 'parsed' THEN loc ELSE 0 END), 0) AS loc
       FROM ingested_files WHERE project_id = ?`,
      projectId,
    )
    : undefined;
  const edgeRow = projectId
    ? one<{ confirmed: number; unresolved: number }>(
      db,
      `SELECT COALESCE(SUM(CASE WHEN resolution = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmed,
              COALESCE(SUM(CASE WHEN resolution = 'unresolved' THEN 1 ELSE 0 END), 0) AS unresolved
       FROM dependency_edges WHERE project_id = ?`,
      projectId,
    )
    : undefined;
  const queued = projectId
    ? num(one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM intent_summaries WHERE project_id = ? AND queued_for_review = 1 AND status = 'inferred'", projectId)?.n)
    : 0;
  const topDiscrepancies = projectId
    ? all<{ id: string; impact_rank: number; severity: string; description: string; module_name: string; module_id: string }>(
      db,
      `SELECT d.id, d.impact_rank, d.severity, d.description, m.name AS module_name, d.module_id
       FROM discrepancies d JOIN modules m ON m.id = d.module_id
       WHERE d.project_id = ?
       ORDER BY d.impact_rank ASC
       LIMIT 5`,
      projectId,
    )
    : [];
  const statuses = projectId
    ? {
      ingestion: project?.ingestion_status ?? "not_started",
      analysis: project?.analysis_status ?? "not_started",
      summary: project?.summary_status ?? "not_started",
      discrepancy: project?.discrepancy_status ?? "not_started",
    }
    : null;
  const complete = statuses ? Object.values(statuses).filter((status) => status === "complete").length : 0;
  const validated = num(summaryRow?.validated);
  const unreviewed = Math.max(0, num(summaryRow?.summaries) - validated);
  const id = projectId ?? "";
  const nextAction = !projectId
    ? { label: "Open demo project", to: null, reason: "No project is selected." }
    : statuses?.ingestion === "failed"
      ? { label: "Retry ingestion", to: `/progress/${id}`, reason: project?.ingestion_error || "Ingestion failed." }
      : statuses?.ingestion !== "complete"
        ? { label: "Watch ingestion", to: `/progress/${id}`, reason: "Ingestion has not finished." }
        : statuses?.analysis === "failed"
          ? { label: "Open the dependency map", to: `/dependency-map/${id}`, reason: project?.analysis_error || "Dependency analysis failed." }
          : statuses?.analysis !== "complete"
            ? { label: "Map dependencies", to: `/dependency-map/${id}`, reason: "The dependency map has not been built." }
            : statuses?.summary === "failed"
              ? { label: "Open intent summaries", to: `/intent-summaries/${id}`, reason: project?.summary_error || "Intent summaries failed." }
              : statuses?.summary !== "complete"
                ? { label: "Summarize intent", to: `/intent-summaries/${id}`, reason: "Parsed modules have no intent summaries yet." }
                : validated === 0
                  ? { label: "Review intent", to: `/intent-review/${id}`, reason: "Discrepancy detection waits for a confirmed or corrected summary." }
                  : statuses?.discrepancy === "failed" || statuses?.discrepancy === "blocked"
                    ? { label: "Open discrepancies", to: `/discrepancies/${id}`, reason: project?.discrepancy_error || "Compare is blocked until intent is validated." }
                    : statuses?.discrepancy !== "complete"
                      ? { label: "Compare with validated intent", to: `/discrepancies/${id}`, reason: "Validated intent has not been compared with the code." }
                      : { label: "Review discrepancies", to: `/discrepancies/${id}`, reason: "Compare is complete. Conflicts are ranked by stored impact." };
  const scoped = Boolean(projectId);
  return {
    projectId: projectId ?? null,
    projectName: project?.name ?? null,
    demonstration: project?.source_ref === DEMO_SOURCE_REF,
    modulesParsed: scoped ? num(moduleRow?.n) : 0,
    intentSummaries: scoped ? num(summaryRow?.summaries) : 0,
    validatedByExperts: scoped ? validated : 0,
    atRisk: scoped ? num(summaryRow?.at_risk) : 0,
    discrepancies: scoped ? num(discrepancyRow?.n) : 0,
    confidence: {
      low: scoped ? num(summaryRow?.low) : 0,
      medium: scoped ? num(summaryRow?.medium) : 0,
      high: scoped ? num(summaryRow?.high) : 0,
    },
    clusters: scoped ? clusters.map((cluster) => ({
      directory: cluster.directory,
      modules: num(cluster.modules),
      low: num(cluster.low),
    })) : [],
    activity: scoped ? [...events, ...revisions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10) : [],
    stageProgress: projectId ? complete / 4 : null,
    statuses,
    fileCount: num(fileRow?.files),
    flaggedFiles: num(fileRow?.flagged),
    totalLoc: num(fileRow?.loc),
    edgesConfirmed: num(edgeRow?.confirmed),
    edgesUnresolved: num(edgeRow?.unresolved),
    reviewQueued: queued,
    unreviewed,
    excludedUnreviewed: num(project?.excluded_unreviewed),
    topDiscrepancies: topDiscrepancies.map((item) => ({
      id: item.id,
      impactRank: num(item.impact_rank),
      severity: item.severity,
      description: item.description,
      moduleName: item.module_name,
      moduleId: item.module_id,
    })),
    nextAction,
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
