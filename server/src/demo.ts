import { rmSync } from "node:fs";
import { one, run, type AppDatabase } from "./db.js";
import { HttpError } from "./http.js";
import {
  DEMO_SOURCE_REF,
  confirmSummary,
  correctSummary,
  kick,
  queueAnalysis,
  queueDiscrepancies,
  queueSummaries,
  requireProject,
  sourceDirectory,
  startSampleProject,
} from "./pipeline.js";

const DEMO_NAME = "Demonstration project";
const ACCOUNT_CORRECTION = "Open an account and keep the contracted discount rate for billing.";

const tails = new WeakMap<AppDatabase, Promise<unknown>>();

function exclusive<T>(db: AppDatabase, work: () => Promise<T>): Promise<T> {
  const previous = tails.get(db) ?? Promise.resolve();
  const run = previous.then(work, work);
  tails.set(db, run.then(() => undefined, () => undefined));
  return run;
}

type SummaryHit = { id: string; status: string; name: string; confidence: string };

function summaryByName(db: AppDatabase, projectId: string, name: string) {
  return one<SummaryHit>(
    db,
    `SELECT s.id, s.status, s.confidence, m.name
     FROM intent_summaries s JOIN modules m ON m.id = s.module_id
     WHERE s.project_id = ? AND m.name = ?`,
    projectId,
    name,
  );
}

function applyReviews(db: AppDatabase, projectId: string) {
  const invoice = summaryByName(db, projectId, "billing/invoice.js");
  const account = summaryByName(db, projectId, "customers/account.js");
  if (!invoice) throw new HttpError(500, "DEMO_INCOMPLETE", "The demonstration project has no summary for billing/invoice.js.");
  if (!account) throw new HttpError(500, "DEMO_INCOMPLETE", "The demonstration project has no summary for customers/account.js.");
  if (invoice.status === "inferred") confirmSummary(db, invoice.id, "user-ada");
  if (account.status === "inferred") correctSummary(db, account.id, "user-ravi", ACCOUNT_CORRECTION, false);
}

async function advance(db: AppDatabase, projectId: string) {
  await kick(db);
  let project = requireProject(db, projectId);
  if (project.ingestion_status === "failed") {
    throw new HttpError(409, "INGESTION_FAILED", project.ingestion_error || "Ingestion failed.");
  }
  if (project.ingestion_status !== "complete") {
    throw new HttpError(409, "INGESTION_INCOMPLETE", "Ingestion did not finish.");
  }

  if (project.analysis_status !== "complete") {
    if (project.analysis_status === "not_started" || project.analysis_status === "failed") queueAnalysis(db, projectId);
    await kick(db);
    project = requireProject(db, projectId);
    if (project.analysis_status !== "complete") {
      throw new HttpError(409, "ANALYSIS_FAILED", project.analysis_error || "Dependency analysis did not finish.");
    }
  }

  if (project.summary_status !== "complete") {
    if (project.summary_status === "not_started" || project.summary_status === "failed") queueSummaries(db, projectId);
    await kick(db);
    project = requireProject(db, projectId);
    if (project.summary_status !== "complete") {
      throw new HttpError(409, "SUMMARY_FAILED", project.summary_error || "Intent summaries did not finish.");
    }
  }

  applyReviews(db, projectId);
  project = requireProject(db, projectId);
  if (project.discrepancy_status !== "complete") {
    queueDiscrepancies(db, projectId);
    await kick(db);
    project = requireProject(db, projectId);
    if (project.discrepancy_status !== "complete") {
      throw new HttpError(409, "COMPARE_FAILED", project.discrepancy_error || "Discrepancy detection did not finish.");
    }
  }
  return projectId;
}

async function openInner(db: AppDatabase, userId: string) {
  const existing = one<{ id: string }>(db, "SELECT id FROM projects WHERE source_ref = ?", DEMO_SOURCE_REF);
  let created = false;
  let projectId = existing?.id;
  if (!projectId) {
    created = true;
    projectId = startSampleProject(db, { name: DEMO_NAME, userId, sourceRef: DEMO_SOURCE_REF });
  }
  await advance(db, projectId);
  return { projectId, created };
}

export function openDemoProject(db: AppDatabase, userId: string) {
  return exclusive(db, () => openInner(db, userId));
}

function deleteProjectRows(db: AppDatabase, projectId: string) {
  run(db, "DELETE FROM jobs WHERE project_id = ?", projectId);
  run(db, "DELETE FROM discrepancies WHERE project_id = ?", projectId);
  run(db, "DELETE FROM intent_revisions WHERE summary_id IN (SELECT id FROM intent_summaries WHERE project_id = ?)", projectId);
  run(db, "DELETE FROM intent_summaries WHERE project_id = ?", projectId);
  run(db, "DELETE FROM dependency_edges WHERE project_id = ?", projectId);
  run(db, "DELETE FROM modules WHERE project_id = ?", projectId);
  run(db, "DELETE FROM ingested_files WHERE project_id = ?", projectId);
  run(db, "DELETE FROM ingestion_events WHERE project_id = ?", projectId);
  run(db, "DELETE FROM projects WHERE id = ?", projectId);
}

async function resetInner(db: AppDatabase) {
  const existing = one<{ id: string }>(db, "SELECT id FROM projects WHERE source_ref = ?", DEMO_SOURCE_REF);
  if (!existing) return { reset: false as const };
  deleteProjectRows(db, existing.id);
  rmSync(sourceDirectory(existing.id), { recursive: true, force: true });
  return { reset: true as const, projectId: existing.id };
}

export function resetDemoProject(db: AppDatabase) {
  return exclusive(db, () => resetInner(db));
}
