import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveRelative, parseSource, type ParsedSource } from "./analysis/parse.js";
import { all, one, run, type AppDatabase } from "./db.js";
import { findDiscrepancies, impactScore, rankFindings } from "./discrepancy/compare.js";
import { classifyFile } from "./ingest/classify.js";
import { validateGitUrl } from "./ingest/gitUrl.js";
import { isUnsafeZipPath, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES } from "./ingest/zipSafe.js";
import { HttpError } from "./http.js";
import { scoreConfidence, type ConfidenceLevel } from "./intent/confidence.js";
import { maybeEnhanceSummary } from "./intent/llm.js";
import { buildDeterministicSummary, type EvidenceRef } from "./intent/summarize.js";

const pumps = new WeakMap<AppDatabase, Promise<void>>();

type ProjectRow = {
  id: string;
  name: string;
  source_type: string;
  source_ref: string | null;
  preflight_error: string | null;
  created_by: string | null;
  ingestion_status: string;
  ingestion_stage: string;
  ingestion_error: string | null;
  analysis_status: string;
  analysis_error: string | null;
  summary_status: string;
  summary_error: string | null;
  summary_mode: string | null;
  discrepancy_status: string;
  discrepancy_error: string | null;
  excluded_unreviewed: number;
  created_at: string;
  updated_at: string;
};

type FileRow = {
  id: string;
  project_id: string;
  path: string;
  language: string | null;
  loc: number | null;
  status: string;
  rejection_reason: string | null;
  content_hash: string | null;
  source_text: string | null;
};

type ModuleRow = {
  id: string;
  project_id: string;
  file_id: string | null;
  name: string;
  kind: string;
  directory: string;
  start_line: number | null;
  end_line: number | null;
};

type SummaryRow = {
  id: string;
  project_id: string;
  module_id: string;
  text: string;
  confidence: ConfidenceLevel;
  confidence_score: number;
  rationale_json: string;
  evidence_json: string;
  source_hash: string;
  mode: string;
  status: string;
  queued_for_review: number;
  reviewer_id: string | null;
  reviewed_at: string | null;
  source_drift: number;
  generated_at: string;
};

export function repositoryRoot(): string {
  return path.resolve(import.meta.dirname, "../..");
}

export function sourceDirectory(projectId: string): string {
  return path.join(repositoryRoot(), "data", "sources", projectId);
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function now(): string {
  return new Date().toISOString();
}

function touch(db: AppDatabase, projectId: string, fields: Record<string, string | number | null>) {
  const keys = Object.keys(fields);
  const sql = `UPDATE projects SET ${keys.map((key) => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`;
  run(db, sql, ...keys.map((key) => fields[key]), now(), projectId);
}

function stage(db: AppDatabase, projectId: string, name: string, detail?: string) {
  touch(db, projectId, { ingestion_status: name === "complete" || name === "failed" ? name : "running", ingestion_stage: name });
  run(db, "INSERT INTO ingestion_events (id, project_id, stage, detail, created_at) VALUES (?, ?, ?, ?, ?)", randomUUID(), projectId, name, detail ?? null, now());
}

export function kick(db: AppDatabase) {
  const previous = pumps.get(db) ?? Promise.resolve();
  const next = previous.then(() => pump(db)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "job failed";
    console.error(`MoltProtocol job error: ${message}`);
  });
  pumps.set(db, next);
  return next;
}

function enqueue(db: AppDatabase, projectId: string, type: string) {
  const stamp = now();
  run(db, "INSERT INTO jobs (id, project_id, type, status, stage, error, created_at, updated_at) VALUES (?, ?, ?, 'queued', NULL, NULL, ?, ?)", randomUUID(), projectId, type, stamp, stamp);
  return kick(db);
}

async function pump(db: AppDatabase) {
  for (;;) {
    const job = one<{ id: string; project_id: string; type: string }>(db, "SELECT id, project_id, type FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1");
    if (!job) return;
    run(db, "UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ?", now(), job.id);
    try {
      if (job.type === "ingest") await runIngestion(db, job.project_id);
      else if (job.type === "analyze") await runAnalysis(db, job.project_id);
      else if (job.type === "summarize") await runSummaries(db, job.project_id);
      else if (job.type === "discrepancies") await runDiscrepancies(db, job.project_id);
      run(db, "UPDATE jobs SET status = 'complete', updated_at = ? WHERE id = ?", now(), job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Processing failed";
      run(db, "UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?", message, now(), job.id);
      if (job.type === "ingest") touch(db, job.project_id, { ingestion_status: "failed", ingestion_stage: "failed", ingestion_error: message });
      if (job.type === "analyze") touch(db, job.project_id, { analysis_status: "failed", analysis_error: message });
      if (job.type === "summarize") touch(db, job.project_id, { summary_status: "failed", summary_error: message });
      if (job.type === "discrepancies") touch(db, job.project_id, { discrepancy_status: "failed", discrepancy_error: message });
    }
  }
}

function insertProject(db: AppDatabase, input: { name: string; sourceType: string; sourceRef: string; userId: string; preflightError?: string }) {
  const id = randomUUID();
  const stamp = now();
  run(
    db,
    `INSERT INTO projects (
      id, name, source_type, source_ref, preflight_error, created_by,
      ingestion_status, ingestion_stage, analysis_status, summary_status, discrepancy_status,
      excluded_unreviewed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 'queued', 'not_started', 'not_started', 'not_started', 0, ?, ?)`,
    id, input.name.trim(), input.sourceType, input.sourceRef, input.preflightError ?? null, input.userId, stamp, stamp,
  );
  return id;
}

export function startUploadProject(db: AppDatabase, input: { name: string; userId: string; files: { path: string; bytes: Buffer }[]; preflightError?: string; sourceRef: string }) {
  if (!input.name.trim()) throw new HttpError(400, "VALIDATION", "Project name is required.", { name: "Enter a project name." });
  const id = insertProject(db, { name: input.name, sourceType: "upload", sourceRef: input.sourceRef, userId: input.userId, preflightError: input.preflightError });
  if (!input.preflightError) writeSourceFiles(id, input.files);
  enqueue(db, id, "ingest");
  return id;
}

export function startGitProject(db: AppDatabase, input: { name: string; userId: string; url: string }) {
  const checked = validateGitUrl(input.url);
  if (!checked.ok) throw new HttpError(400, "VALIDATION", checked.message, { url: checked.message });
  if (!input.name.trim()) throw new HttpError(400, "VALIDATION", "Project name is required.", { name: "Enter a project name." });
  const id = insertProject(db, { name: input.name, sourceType: "git", sourceRef: checked.href, userId: input.userId });
  enqueue(db, id, "ingest");
  return id;
}

export function startSampleProject(db: AppDatabase, input: { name: string; userId: string }) {
  const id = insertProject(db, { name: input.name.trim() || "Sample legacy billing", sourceType: "sample", sourceRef: "fixtures/sample-legacy", userId: input.userId });
  const dest = sourceDirectory(id);
  mkdirSync(dest, { recursive: true });
  cpSync(path.join(repositoryRoot(), "fixtures", "sample-legacy"), dest, { recursive: true });
  enqueue(db, id, "ingest");
  return id;
}

export function retryIngestion(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  if (project.ingestion_status !== "failed") {
    throw new HttpError(409, "NOT_RETRYABLE", "Only a failed ingestion can be retried.");
  }
  run(db, "DELETE FROM ingested_files WHERE project_id = ?", projectId);
  touch(db, projectId, { ingestion_status: "queued", ingestion_stage: "queued", ingestion_error: null });
  enqueue(db, projectId, "ingest");
}

function writeSourceFiles(projectId: string, files: { path: string; bytes: Buffer }[]) {
  const root = sourceDirectory(projectId);
  mkdirSync(root, { recursive: true });
  for (const file of files) {
    const rel = file.path.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!rel || isUnsafeZipPath(rel)) {
      throw new HttpError(400, "UNSAFE_PATH", "A file path tried to leave the project directory.");
    }
    const dest = path.join(root, rel);
    const relative = path.relative(root, dest);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new HttpError(400, "UNSAFE_PATH", "A file path tried to leave the project directory.");
    }
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, file.bytes);
  }
}

function listFiles(root: string): { path: string; bytes: Buffer }[] {
  if (!statSafe(root)) return [];
  const files: { path: string; bytes: Buffer }[] = [];
  let total = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist") continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const rel = path.relative(root, absolute).split(path.sep).join("/");
      const size = statSync(absolute).size;
      total += size;
      if (total > MAX_UNCOMPRESSED_BYTES) {
        throw new Error("Ingest exceeded the 20 MB source budget and was stopped.");
      }
      files.push({ path: rel, bytes: size > MAX_SINGLE_FILE_BYTES ? Buffer.alloc(0) : readFileSync(absolute) });
      if (size > MAX_SINGLE_FILE_BYTES) {
        files[files.length - 1] = { path: rel, bytes: Buffer.from(`__MOLT_TOO_LARGE__${size}`) };
      }
    }
  };
  walk(root);
  return files;
}

function statSafe(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

async function runIngestion(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  stage(db, projectId, "receiving", project.source_type);
  if (project.preflight_error) {
    stage(db, projectId, "detecting");
    insertFile(db, projectId, { path: project.source_ref || "archive.zip", bytes: Buffer.alloc(0), forced: { status: "corrupted", reason: project.preflight_error, language: null } });
    stage(db, projectId, "complete", "Archive rejected before extraction.");
    touch(db, projectId, { ingestion_status: "complete", ingestion_stage: "complete", ingestion_error: null });
    return;
  }

  if (project.source_type === "git") {
    stage(db, projectId, "receiving", "Cloning repository");
    const dest = sourceDirectory(projectId);
    rmSync(dest, { recursive: true, force: true });
    try {
      await cloneRepository(project.source_ref || "", dest);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clone failed";
      stage(db, projectId, "failed", message);
      touch(db, projectId, { ingestion_status: "failed", ingestion_stage: "failed", ingestion_error: message });
      return;
    }
  }

  stage(db, projectId, "detecting");
  const files = listFiles(sourceDirectory(projectId));
  stage(db, projectId, "parsing", `${files.length} files`);
  run(db, "DELETE FROM ingested_files WHERE project_id = ?", projectId);
  for (const file of files) {
    if (file.bytes.toString("utf8").startsWith("__MOLT_TOO_LARGE__")) {
      insertFile(db, projectId, { path: file.path, bytes: Buffer.alloc(0), forced: { status: "corrupted", reason: "File exceeds the 1 MB per-file analysis limit.", language: null } });
      continue;
    }
    insertFile(db, projectId, file);
  }
  stage(db, projectId, "storing");
  stage(db, projectId, "complete");
  touch(db, projectId, { ingestion_status: "complete", ingestion_stage: "complete", ingestion_error: null });
}

function insertFile(db: AppDatabase, projectId: string, file: { path: string; bytes: Buffer; forced?: { status: string; reason: string; language: string | null } }) {
  if (file.forced) {
    run(
      db,
      "INSERT INTO ingested_files (id, project_id, path, language, loc, status, rejection_reason, content_hash, source_text) VALUES (?, ?, ?, ?, 0, ?, ?, NULL, NULL)",
      randomUUID(), projectId, file.path, file.forced.language, file.forced.status, file.forced.reason,
    );
    return;
  }
  const classified = classifyFile(file.path, file.bytes);
  let status = classified.status;
  let reason = classified.rejectionReason;
  let text = classified.text;
  let loc = classified.loc;
  if (status === "parsed" && text) {
    const parsed = parseSource(file.path, text);
    if ("error" in parsed) {
      status = "corrupted";
      reason = parsed.error;
    } else if (loc === 0) {
      status = "corrupted";
      reason = "File is empty.";
    }
  }
  const stored = text && text.length <= 100_000 ? text : null;
  run(
    db,
    "INSERT INTO ingested_files (id, project_id, path, language, loc, status, rejection_reason, content_hash, source_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(), projectId, file.path, classified.language, loc, status, reason, text ? contentHash(text) : null, stored,
  );
}

export function cloneRepository(url: string, dest: string): Promise<void> {
  const checked = validateGitUrl(url);
  if (!checked.ok) return Promise.reject(new Error(checked.message));
  mkdirSync(path.dirname(dest), { recursive: true });
  return new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      ["-c", "core.hooksPath=/dev/null", "clone", "--depth", "1", "--single-branch", "--no-tags", "--", checked.href, dest],
      { env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-500);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Clone exceeded the 25 second budget."));
    }, 25_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.replace(/https:\/\/\S+/g, "https://[redacted]").trim() || `git clone exited ${code}`));
    });
  });
}

export function queueAnalysis(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  if (project.ingestion_status !== "complete") throw new HttpError(409, "INGESTION_INCOMPLETE", "Dependency analysis waits until ingestion has completed.");
  touch(db, projectId, { analysis_status: "queued", analysis_error: null });
  enqueue(db, projectId, "analyze");
}

async function runAnalysis(db: AppDatabase, projectId: string) {
  touch(db, projectId, { analysis_status: "running", analysis_error: null });
  const files = all<FileRow>(db, "SELECT * FROM ingested_files WHERE project_id = ? AND status = 'parsed'", projectId);
  const paths = new Set(files.map((file) => file.path));
  run(db, "DELETE FROM dependency_edges WHERE project_id = ?", projectId);

  for (const file of files) {
    upsertModule(db, { projectId, fileId: file.id, name: file.path, kind: "file", directory: directoryOf(file.path), startLine: 1, endLine: file.loc ?? 1 });
  }

  for (const file of files) {
    if (!file.source_text) continue;
    const parsed = parseSource(file.path, file.source_text);
    if ("error" in parsed) continue;
    const fromId = moduleIdByName(db, projectId, file.path);
    if (!fromId) continue;
    for (const item of parsed.imports) {
      const resolved = resolveRelative(file.path, item.specifier, paths);
      const external = !item.specifier.startsWith(".");
      const targetName = resolved ?? (external ? `external:${item.specifier}` : `missing:${item.specifier}`);
      const resolution = resolved ? "confirmed" : "unresolved";
      const detail = resolved ? null : external ? "external package not included in the ingest" : "missing file";
      const toId = resolved
        ? moduleIdByName(db, projectId, resolved)
        : upsertModule(db, { projectId, fileId: null, name: targetName, kind: external ? "external" : "unresolved", directory: external ? "external" : "unresolved", startLine: null, endLine: null });
      if (!toId) continue;
      run(
        db,
        "INSERT INTO dependency_edges (id, project_id, from_module_id, to_module_id, relationship, resolution, detail) VALUES (?, ?, ?, ?, 'import', ?, ?)",
        randomUUID(), projectId, fromId, toId, resolution, detail,
      );
      for (const binding of item.names) {
        const called = parsed.functions.some((fn) => fn.calls.some((call) => call.name === binding || call.name.startsWith(`${binding}.`)));
        if (!called) continue;
        run(
          db,
          "INSERT INTO dependency_edges (id, project_id, from_module_id, to_module_id, relationship, resolution, detail) VALUES (?, ?, ?, ?, 'call', ?, ?)",
          randomUUID(), projectId, fromId, toId, resolution, detail,
        );
      }
    }
  }
  touch(db, projectId, { analysis_status: "complete" });
}

export function queueSummaries(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  if (project.analysis_status !== "complete") throw new HttpError(409, "ANALYSIS_INCOMPLETE", "Intent summaries use the modules produced by dependency analysis.");
  touch(db, projectId, { summary_status: "queued", summary_error: null });
  enqueue(db, projectId, "summarize");
}

export async function runSummaries(db: AppDatabase, projectId: string) {
  touch(db, projectId, { summary_status: "running" });
  const modules = all<ModuleRow>(db, "SELECT * FROM modules WHERE project_id = ? AND kind = 'file'", projectId);
  const files = all<FileRow>(db, "SELECT * FROM ingested_files WHERE project_id = ?", projectId);
  const parsedPaths = files.filter((file) => file.status === "parsed").map((file) => file.path);
  let mode: "deterministic" | "llm" = "deterministic";
  let written = 0;
  let skippedUnchanged = 0;
  let preservedValidated = 0;

  for (const moduleRow of modules) {
    const file = files.find((item) => item.id === moduleRow.file_id);
    if (!file?.source_text) continue;
    const parsed = parseSource(file.path, file.source_text);
    if ("error" in parsed) continue;
    const hash = contentHash(file.source_text);
    const existing = one<SummaryRow>(db, "SELECT * FROM intent_summaries WHERE module_id = ?", moduleRow.id);
    if (existing && existing.source_hash === hash) {
      skippedUnchanged += 1;
      continue;
    }
    if (existing && (existing.status === "confirmed" || existing.status === "corrected")) {
      run(db, "UPDATE intent_summaries SET source_drift = 1 WHERE id = ?", existing.id);
      preservedValidated += 1;
      continue;
    }

    const unresolved = countMissingImports(parsed, file.path, new Set(parsedPaths));
    const names = [file.path.split("/").pop()?.replace(/\..*$/, "") ?? "", ...parsed.functions.map((fn) => fn.name)];
    const confidence = scoreConfidence({
      commentChars: parsed.commentChars,
      codeChars: parsed.codeChars,
      names,
      hasTestFile: hasTestFile(file.path, parsedPaths),
      branchCount: parsed.branchCount,
      functionCount: Math.max(parsed.functions.length, 1),
      unresolvedRelativeImports: unresolved,
    });
    const described = parsed.imports.map((item) => item.specifier);
    const draft = buildDeterministicSummary(file.path, parsed, described);
    const enhanced = await maybeEnhanceSummary(draft.text, file.source_text);
    mode = enhanced.mode;
    const stamp = now();
    if (!existing) {
      const id = randomUUID();
      run(
        db,
        `INSERT INTO intent_summaries (
          id, project_id, module_id, text, confidence, confidence_score, rationale_json, evidence_json,
          source_hash, mode, status, queued_for_review, source_drift, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inferred', 0, 0, ?)`,
        id, projectId, moduleRow.id, enhanced.text, confidence.level, confidence.score, JSON.stringify(confidence.rationale), JSON.stringify(draft.evidence), hash, enhanced.mode, stamp,
      );
      addRevision(db, id, 1, enhanced.text, "generated", null, stamp);
    } else {
      run(
        db,
        `UPDATE intent_summaries
         SET text = ?, confidence = ?, confidence_score = ?, rationale_json = ?, evidence_json = ?, source_hash = ?, mode = ?, generated_at = ?, source_drift = 0
         WHERE id = ?`,
        enhanced.text, confidence.level, confidence.score, JSON.stringify(confidence.rationale), JSON.stringify(draft.evidence), hash, enhanced.mode, stamp, existing.id,
      );
      const version = nextVersion(db, existing.id);
      addRevision(db, existing.id, version, enhanced.text, "generated", null, stamp);
    }
    written += 1;
  }

  touch(db, projectId, { summary_status: "complete", summary_mode: mode });
  return { written, skippedUnchanged, preservedValidated, mode };
}

function countMissingImports(parsed: ParsedSource, filePath: string, files: Set<string>): number {
  return parsed.imports.filter((item) => item.specifier.startsWith(".") && !resolveRelative(filePath, item.specifier, files)).length;
}

function hasTestFile(filePath: string, files: string[]): boolean {
  const base = filePath.replace(/\.(jsx|tsx|mjs|cjs|js|ts)$/, "");
  const short = base.split("/").pop() ?? base;
  return files.some((file) => file !== filePath && (file.includes(`/${short}.test.`) || file.includes(`/${short}.spec.`) || file.startsWith(`${base}.test.`) || file.startsWith(`${base}.spec.`)));
}

export function queueForReview(db: AppDatabase, summaryId: string, userId: string) {
  const summary = requireSummary(db, summaryId);
  requireProjectOwner(db, summary.project_id, userId);
  run(db, "UPDATE intent_summaries SET queued_for_review = 1 WHERE id = ?", summaryId);
  return summary.project_id;
}

export function confirmSummary(db: AppDatabase, summaryId: string, userId: string) {
  const summary = requireSummary(db, summaryId);
  const stamp = now();
  run(db, "UPDATE intent_summaries SET status = 'confirmed', reviewer_id = ?, reviewed_at = ?, queued_for_review = 1 WHERE id = ?", userId, stamp, summaryId);
  addRevision(db, summaryId, nextVersion(db, summaryId), summary.text, "confirmed", userId, stamp);
  return summary.project_id;
}

export function correctSummary(db: AppDatabase, summaryId: string, userId: string, text: string, acknowledgeOverride: boolean) {
  const summary = requireSummary(db, summaryId);
  const correction = text.trim();
  if (!correction) throw new HttpError(400, "VALIDATION", "A correction needs the replacement intent text.", { text: "Enter the corrected intent." });
  if ((summary.status === "confirmed" || summary.status === "corrected") && !acknowledgeOverride) {
    throw new HttpError(409, "OVERRIDE_REQUIRED", "This summary was already validated. Confirm the override to replace it.");
  }
  const stamp = now();
  run(db, "UPDATE intent_summaries SET text = ?, status = 'corrected', reviewer_id = ?, reviewed_at = ?, queued_for_review = 1, source_drift = 0 WHERE id = ?", correction, userId, stamp, summaryId);
  addRevision(db, summaryId, nextVersion(db, summaryId), correction, "corrected", userId, stamp);
  return summary.project_id;
}

function addRevision(db: AppDatabase, summaryId: string, version: number, text: string, action: string, reviewerId: string | null, stamp: string) {
  run(db, "INSERT INTO intent_revisions (id, summary_id, version, text, action, reviewer_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", randomUUID(), summaryId, version, text, action, reviewerId, stamp);
}

function nextVersion(db: AppDatabase, summaryId: string): number {
  const row = one<{ version: number }>(db, "SELECT COALESCE(MAX(version), 0) AS version FROM intent_revisions WHERE summary_id = ?", summaryId);
  return (row?.version ?? 0) + 1;
}

export function queueDiscrepancies(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  if (project.analysis_status !== "complete" || project.summary_status !== "complete") {
    throw new HttpError(409, "NOT_READY", "Discrepancy detection needs dependency analysis and intent summaries.");
  }
  touch(db, projectId, { discrepancy_status: "queued", discrepancy_error: null });
  enqueue(db, projectId, "discrepancies");
}

async function runDiscrepancies(db: AppDatabase, projectId: string) {
  touch(db, projectId, { discrepancy_status: "running" });
  const summaries = all<SummaryRow>(db, "SELECT * FROM intent_summaries WHERE project_id = ?", projectId);
  const validated = summaries.filter((summary) => summary.status === "confirmed" || summary.status === "corrected");
  const unreviewed = summaries.length - validated.length;
  if (validated.length === 0) {
    touch(db, projectId, {
      discrepancy_status: "blocked",
      discrepancy_error: "Discrepancy detection compares code with validated intent. No summary has been confirmed or corrected yet.",
      excluded_unreviewed: unreviewed,
    });
    return;
  }

  const modules = all<ModuleRow>(db, "SELECT * FROM modules WHERE project_id = ?", projectId);
  const files = all<FileRow>(db, "SELECT * FROM ingested_files WHERE project_id = ?", projectId);
  const edges = all<{ from_module_id: string; to_module_id: string; resolution: string; detail: string | null }>(db, "SELECT from_module_id, to_module_id, resolution, detail FROM dependency_edges WHERE project_id = ?", projectId);
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.from_module_id, (degree.get(edge.from_module_id) ?? 0) + 1);
    degree.set(edge.to_module_id, (degree.get(edge.to_module_id) ?? 0) + 1);
  }
  const maxDegree = Math.max(1, ...degree.values());
  const previous = all<{ module_id: string; rule_id: string; status: string }>(db, "SELECT module_id, rule_id, status FROM discrepancies WHERE project_id = ?", projectId);
  run(db, "DELETE FROM discrepancies WHERE project_id = ?", projectId);

  const pending: { moduleId: string; summaryId: string; ruleId: string; description: string; excerpt: string; intent: string; startLine: number; endLine: number; severity: "high" | "medium" | "low"; impact: number; factors: Record<string, number> }[] = [];
  for (const summary of validated) {
    const moduleRow = modules.find((item) => item.id === summary.module_id);
    const file = files.find((item) => item.id === moduleRow?.file_id);
    if (!moduleRow || !file?.source_text) continue;
    const parsed = parseSource(file.path, file.source_text);
    if ("error" in parsed) continue;
    const missing = edges
      .filter((edge) => edge.from_module_id === moduleRow.id && edge.resolution === "unresolved" && edge.detail === "missing file")
      .map((edge) => modules.find((item) => item.id === edge.to_module_id)?.name.replace(/^missing:/, "") ?? "missing module");
    const findings = findDiscrepancies({
      intentText: summary.text,
      source: file.source_text,
      missingRelativeImports: [...new Set(missing)],
      emptyCatches: parsed.emptyCatches,
      duplicateCalls: parsed.duplicateCalls,
      todos: parsed.todos,
    });
    const centrality = (degree.get(moduleRow.id) ?? 0) / maxDegree;
    for (const finding of findings) {
      const scored = impactScore(finding.severity, centrality, summary.confidence);
      pending.push({
        moduleId: moduleRow.id,
        summaryId: summary.id,
        ruleId: finding.ruleId,
        description: finding.description,
        excerpt: finding.excerpt,
        intent: summary.text,
        startLine: finding.startLine,
        endLine: finding.endLine,
        severity: finding.severity,
        impact: scored.score,
        factors: scored.factors,
      });
    }
  }

  const ranked = rankFindings(pending.map((item) => ({ ...item, impactScore: item.impact })));
  for (const item of ranked) {
    const kept = previous.find((row) => row.module_id === item.moduleId && row.rule_id === item.ruleId && row.status !== "potential");
    run(
      db,
      `INSERT INTO discrepancies (
        id, project_id, module_id, summary_id, rule_id, description, code_excerpt, intent_text,
        evidence_start, evidence_end, severity, impact_score, impact_rank, factors_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), projectId, item.moduleId, item.summaryId, item.ruleId, item.description, item.excerpt, item.intent,
      item.startLine, item.endLine, item.severity, item.impactScore, item.impactRank, JSON.stringify(item.factors), kept?.status ?? "potential", now(),
    );
  }
  touch(db, projectId, {
    discrepancy_status: "complete",
    discrepancy_error: null,
    excluded_unreviewed: unreviewed,
  });
}

export function setDiscrepancyStatus(db: AppDatabase, id: string, status: string) {
  if (!["potential", "reviewed", "confirmed"].includes(status)) {
    throw new HttpError(400, "VALIDATION", "Status must be potential, reviewed, or confirmed.");
  }
  const row = one<{ id: string }>(db, "SELECT id FROM discrepancies WHERE id = ?", id);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Discrepancy was not found.");
  run(db, "UPDATE discrepancies SET status = ? WHERE id = ?", status, id);
}

function upsertModule(db: AppDatabase, input: { projectId: string; fileId: string | null; name: string; kind: string; directory: string; startLine: number | null; endLine: number | null }) {
  const existing = one<{ id: string }>(db, "SELECT id FROM modules WHERE project_id = ? AND name = ?", input.projectId, input.name);
  if (existing) return existing.id;
  const id = randomUUID();
  run(
    db,
    "INSERT INTO modules (id, project_id, file_id, name, kind, directory, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id, input.projectId, input.fileId, input.name, input.kind, input.directory, input.startLine, input.endLine,
  );
  return id;
}

function moduleIdByName(db: AppDatabase, projectId: string, name: string) {
  return one<{ id: string }>(db, "SELECT id FROM modules WHERE project_id = ? AND name = ?", projectId, name)?.id;
}

function directoryOf(filePath: string): string {
  const parts = filePath.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";
}

export function requireProject(db: AppDatabase, projectId: string): ProjectRow {
  const project = one<ProjectRow>(db, "SELECT * FROM projects WHERE id = ?", projectId);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Project was not found.");
  return project;
}

function requireSummary(db: AppDatabase, summaryId: string): SummaryRow {
  const summary = one<SummaryRow>(db, "SELECT * FROM intent_summaries WHERE id = ?", summaryId);
  if (!summary) throw new HttpError(404, "NOT_FOUND", "Intent summary was not found.");
  return summary;
}

function requireProjectOwner(db: AppDatabase, projectId: string, userId: string) {
  requireProject(db, projectId);
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Sign in is required.");
}

export function projectPayload(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  const files = all<FileRow>(db, "SELECT id, project_id, path, language, loc, status, rejection_reason, content_hash FROM ingested_files WHERE project_id = ? ORDER BY path", projectId);
  const events = all<{ stage: string; detail: string | null; created_at: string }>(db, "SELECT stage, detail, created_at FROM ingestion_events WHERE project_id = ? ORDER BY created_at", projectId);
  const languages = new Map<string, { language: string; files: number; loc: number }>();
  for (const file of files) {
    if (file.status !== "parsed" || !file.language) continue;
    const current = languages.get(file.language) ?? { language: file.language, files: 0, loc: 0 };
    current.files += 1;
    current.loc += file.loc ?? 0;
    languages.set(file.language, current);
  }
  const reviewCounts = one<{ queued: number; validated: number }>(
    db,
    `SELECT
      SUM(CASE WHEN queued_for_review = 1 AND status = 'inferred' THEN 1 ELSE 0 END) AS queued,
      SUM(CASE WHEN status IN ('confirmed', 'corrected') THEN 1 ELSE 0 END) AS validated
     FROM intent_summaries WHERE project_id = ?`,
    projectId,
  );
  return {
    id: project.id,
    name: project.name,
    sourceType: project.source_type,
    sourceRef: project.source_ref,
    ingestionStatus: project.ingestion_status,
    ingestionStage: project.ingestion_stage,
    ingestionError: project.ingestion_error,
    analysisStatus: project.analysis_status,
    analysisError: project.analysis_error,
    summaryStatus: project.summary_status,
    summaryError: project.summary_error,
    summaryMode: project.summary_mode ?? "deterministic",
    discrepancyStatus: project.discrepancy_status,
    discrepancyError: project.discrepancy_error,
    excludedUnreviewed: project.excluded_unreviewed,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    stages: events.map((event) => ({ stage: event.stage, detail: event.detail, createdAt: event.created_at })),
    summary: {
      fileCount: files.length,
      parsedCount: files.filter((file) => file.status === "parsed").length,
      rejectedCount: files.filter((file) => file.status !== "parsed").length,
      languages: [...languages.values()],
      totalLoc: [...languages.values()].reduce((sum, item) => sum + item.loc, 0),
    },
    files: files.map((file) => ({
      id: file.id,
      path: file.path,
      language: file.language,
      loc: file.loc,
      status: file.status,
      rejectionReason: file.rejection_reason,
    })),
    reviewQueued: reviewCounts?.queued ?? 0,
    reviewValidated: reviewCounts?.validated ?? 0,
  };
}

export function listProjects(db: AppDatabase) {
  return all<{ id: string }>(db, "SELECT id FROM projects ORDER BY created_at DESC").map((row) => projectPayload(db, row.id));
}

export function graphPayload(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  if (project.ingestion_status !== "complete") {
    throw new HttpError(409, "INGESTION_INCOMPLETE", "Ingestion has not completed, so there is no dependency map yet.");
  }
  const modules = all<ModuleRow>(db, "SELECT * FROM modules WHERE project_id = ? ORDER BY name", projectId);
  const edges = all<{ id: string; from_module_id: string; to_module_id: string; relationship: string; resolution: string; detail: string | null }>(db, "SELECT * FROM dependency_edges WHERE project_id = ?", projectId);
  let message = "";
  if (project.analysis_status === "not_started") message = "Dependency analysis has not been run.";
  else if (project.analysis_status === "queued" || project.analysis_status === "running") message = "Dependency analysis is still running.";
  else if (project.analysis_status === "failed") message = project.analysis_error || "Dependency analysis failed.";
  else if (modules.length === 0) message = "No parsed modules were available to map.";
  else if (edges.length === 0) message = "No dependency relationships were found. Modules are shown without invented edges.";
  return {
    analysisStatus: project.analysis_status,
    message,
    nodes: modules.map((moduleRow) => ({
      id: moduleRow.id,
      name: moduleRow.name,
      kind: moduleRow.kind,
      directory: moduleRow.directory,
      resolution: moduleRow.kind === "file" ? "confirmed" : "unresolved",
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      from: edge.from_module_id,
      to: edge.to_module_id,
      relationship: edge.relationship,
      resolution: edge.resolution,
      detail: edge.detail,
    })),
  };
}

export function moduleDetail(db: AppDatabase, projectId: string, moduleId: string) {
  const graph = graphPayload(db, projectId);
  const node = graph.nodes.find((item) => item.id === moduleId);
  if (!node) throw new HttpError(404, "NOT_FOUND", "Module was not found in this project.");
  const callers = graph.edges.filter((edge) => edge.to === moduleId).map((edge) => ({ ...edge, module: graph.nodes.find((item) => item.id === edge.from) }));
  const callees = graph.edges.filter((edge) => edge.from === moduleId).map((edge) => ({ ...edge, module: graph.nodes.find((item) => item.id === edge.to) }));
  return { module: node, callers, callees };
}

export function summariesPayload(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  const rows = all<SummaryRow & { module_name: string; display_name: string | null }>(
    db,
    `SELECT s.*, m.name AS module_name, u.display_name
     FROM intent_summaries s
     JOIN modules m ON m.id = s.module_id
     LEFT JOIN users u ON u.id = s.reviewer_id
     WHERE s.project_id = ?
     ORDER BY m.name`,
    projectId,
  );
  return {
    summaryStatus: project.summary_status,
    summaryError: project.summary_error,
    mode: project.summary_mode ?? "deterministic",
    demonstration: (project.summary_mode ?? "deterministic") !== "llm",
    summaries: rows.map(presentSummary),
  };
}

function presentSummary(row: SummaryRow & { module_name?: string; display_name?: string | null }) {
  const evidence = JSON.parse(row.evidence_json) as EvidenceRef[];
  return {
    id: row.id,
    projectId: row.project_id,
    moduleId: row.module_id,
    moduleName: row.module_name,
    text: row.text,
    confidence: row.confidence,
    confidenceScore: row.confidence_score,
    rationale: JSON.parse(row.rationale_json) as Record<string, number>,
    evidence,
    sourceHash: row.source_hash,
    mode: row.mode,
    status: row.status,
    queuedForReview: row.queued_for_review === 1,
    reviewerId: row.reviewer_id,
    reviewerName: row.display_name ?? null,
    reviewedAt: row.reviewed_at,
    identityLabel: row.reviewer_id ? "Demo identity" : null,
    sourceDrift: row.source_drift === 1,
    generatedAt: row.generated_at,
  };
}

export function summaryDetail(db: AppDatabase, summaryId: string) {
  const row = one<SummaryRow & { module_name: string; display_name: string | null }>(
    db,
    `SELECT s.*, m.name AS module_name, u.display_name
     FROM intent_summaries s JOIN modules m ON m.id = s.module_id
     LEFT JOIN users u ON u.id = s.reviewer_id WHERE s.id = ?`,
    summaryId,
  );
  if (!row) throw new HttpError(404, "NOT_FOUND", "Intent summary was not found.");
  const revisions = all<{ version: number; text: string; action: string; created_at: string; display_name: string | null }>(
    db,
    `SELECT r.version, r.text, r.action, r.created_at, u.display_name
     FROM intent_revisions r LEFT JOIN users u ON u.id = r.reviewer_id
     WHERE r.summary_id = ? ORDER BY r.version`,
    summaryId,
  );
  return {
    ...presentSummary(row),
    revisions: revisions.map((revision) => ({
      version: revision.version,
      text: revision.text,
      action: revision.action,
      createdAt: revision.created_at,
      reviewerName: revision.display_name,
      identityLabel: revision.display_name ? "Demo identity" : null,
    })),
  };
}

export function reviewQueue(db: AppDatabase, projectId: string) {
  requireProject(db, projectId);
  const rows = all<SummaryRow & { module_name: string; display_name: string | null }>(
    db,
    `SELECT s.*, m.name AS module_name, u.display_name
     FROM intent_summaries s JOIN modules m ON m.id = s.module_id
     LEFT JOIN users u ON u.id = s.reviewer_id
     WHERE s.project_id = ? AND s.queued_for_review = 1
     ORDER BY CASE s.status WHEN 'inferred' THEN 0 ELSE 1 END, m.name`,
    projectId,
  );
  return rows.map((row) => summaryDetail(db, row.id));
}

export function discrepancyPayload(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  const rows = all<{
    id: string; module_id: string; summary_id: string; rule_id: string; description: string; code_excerpt: string; intent_text: string;
    evidence_start: number; evidence_end: number; severity: string; impact_score: number; impact_rank: number; factors_json: string; status: string;
    module_name: string; module_path: string;
  }>(
    db,
    `SELECT d.*, m.name AS module_name, m.name AS module_path
     FROM discrepancies d JOIN modules m ON m.id = d.module_id
     WHERE d.project_id = ? ORDER BY d.impact_rank`,
    projectId,
  );
  return {
    discrepancyStatus: project.discrepancy_status,
    message: project.discrepancy_status === "blocked" || project.discrepancy_status === "failed"
      ? project.discrepancy_error
      : project.discrepancy_status === "not_started"
        ? "Discrepancy detection has not been run."
        : project.excluded_unreviewed > 0
          ? `${project.excluded_unreviewed} unreviewed summaries were excluded. Detection uses validated intent only.`
          : rows.length === 0 && project.discrepancy_status === "complete"
            ? "No potential discrepancies were found in the validated modules. This does not prove the code matches runtime behavior."
            : "",
    excludedUnreviewed: project.excluded_unreviewed,
    items: rows.map((row) => ({
      id: row.id,
      moduleId: row.module_id,
      moduleName: row.module_name,
      summaryId: row.summary_id,
      ruleId: row.rule_id,
      description: row.description,
      codeExcerpt: row.code_excerpt,
      intentText: row.intent_text,
      startLine: row.evidence_start,
      endLine: row.evidence_end,
      severity: row.severity,
      impactScore: row.impact_score,
      impactRank: row.impact_rank,
      factors: JSON.parse(row.factors_json) as Record<string, number>,
      status: row.status,
    })),
  };
}

export function fileSource(db: AppDatabase, projectId: string, filePath: string) {
  const file = one<FileRow>(db, "SELECT * FROM ingested_files WHERE project_id = ? AND path = ?", projectId, filePath);
  if (!file) throw new HttpError(404, "NOT_FOUND", "File was not found in this project.");
  return { path: file.path, status: file.status, rejectionReason: file.rejection_reason, source: file.source_text };
}
