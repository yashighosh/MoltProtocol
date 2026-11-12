import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { MessageChannel, Worker, receiveMessageOnPort } from "node:worker_threads";
import { hashPassword } from "./passwords.js";
import { adaptSql, normalizeRow } from "./sqlAdapt.js";

export type PostgresDatabase = {
  dialect: "postgres";
  query(sql: string, params: unknown[]): Record<string, unknown>[];
};

export type AppDatabase = DatabaseSync | PostgresDatabase;

export function isPostgres(db: AppDatabase): db is PostgresDatabase {
  return "dialect" in db && db.dialect === "postgres";
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  preflight_error TEXT,
  created_by TEXT REFERENCES users(id),
  ingestion_status TEXT NOT NULL,
  ingestion_stage TEXT NOT NULL,
  ingestion_error TEXT,
  analysis_status TEXT NOT NULL DEFAULT 'not_started',
  analysis_error TEXT,
  summary_status TEXT NOT NULL DEFAULT 'not_started',
  summary_error TEXT,
  summary_mode TEXT,
  discrepancy_status TEXT NOT NULL DEFAULT 'not_started',
  discrepancy_error TEXT,
  excluded_unreviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  stage TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingested_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  path TEXT NOT NULL,
  language TEXT,
  loc INTEGER,
  status TEXT NOT NULL,
  rejection_reason TEXT,
  content_hash TEXT,
  source_text TEXT
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  file_id TEXT REFERENCES ingested_files(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  directory TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS dependency_edges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  from_module_id TEXT NOT NULL REFERENCES modules(id),
  to_module_id TEXT NOT NULL REFERENCES modules(id),
  relationship TEXT NOT NULL,
  resolution TEXT NOT NULL,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS intent_summaries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  module_id TEXT NOT NULL REFERENCES modules(id),
  text TEXT NOT NULL,
  confidence TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  rationale_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  queued_for_review INTEGER NOT NULL DEFAULT 0,
  reviewer_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  source_drift INTEGER NOT NULL DEFAULT 0,
  generated_at TEXT NOT NULL,
  UNIQUE(module_id)
);

CREATE TABLE IF NOT EXISTS intent_revisions (
  id TEXT PRIMARY KEY,
  summary_id TEXT NOT NULL REFERENCES intent_summaries(id),
  version INTEGER NOT NULL,
  text TEXT NOT NULL,
  action TEXT NOT NULL,
  reviewer_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discrepancies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  module_id TEXT NOT NULL REFERENCES modules(id),
  summary_id TEXT NOT NULL REFERENCES intent_summaries(id),
  rule_id TEXT NOT NULL,
  description TEXT NOT NULL,
  code_excerpt TEXT NOT NULL,
  intent_text TEXT NOT NULL,
  evidence_start INTEGER,
  evidence_end INTEGER,
  severity TEXT NOT NULL,
  impact_score REAL NOT NULL,
  impact_rank INTEGER NOT NULL,
  factors_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_demo_marker ON projects(source_ref) WHERE source_ref = 'demo:fixtures/sample-legacy';

CREATE TABLE IF NOT EXISTS demo_rule_decisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  status TEXT NOT NULL,
  justification TEXT,
  decided_by TEXT,
  decided_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export function openDatabase(filePath: string): DatabaseSync {
  if (filePath !== ":memory:") {
    mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  seedUsers(db);
  return db;
}

const DEMO_USERS = [
  ["user-ada", "ada.okonkwo@moltprotocol.demo", "Ada Okonkwo"],
  ["user-ravi", "ravi.shah@moltprotocol.demo", "Ravi Shah"],
] as const;

function seedUsers(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (row.n > 0) return;
  const now = new Date().toISOString();
  const insert = db.prepare(
    "INSERT INTO users (id, email, display_name, password_hash, is_demo, created_at) VALUES (?, ?, ?, ?, 1, ?)",
  );
  for (const [id, email, name] of DEMO_USERS) insert.run(id, email, name, hashPassword("demo-pass"), now);
}

function seedPostgres(db: PostgresDatabase) {
  run(
    db,
    `CREATE TABLE IF NOT EXISTS demo_rule_decisions (
      id text PRIMARY KEY,
      project_id text NOT NULL,
      rule_id text NOT NULL,
      status text NOT NULL,
      justification text,
      decided_by text,
      decided_at timestamptz NOT NULL
    )`,
  );
  const row = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM users");
  if ((row?.n ?? 0) > 0) return;
  const now = new Date().toISOString();
  for (const [id, email, name] of DEMO_USERS) {
    run(
      db,
      "INSERT INTO users (id, email, display_name, password_hash, is_demo, created_at) VALUES (?, ?, ?, ?, 1, ?)",
      id, email, name, hashPassword("demo-pass"), now,
    );
  }
}

export function openPostgres(connectionString: string): PostgresDatabase {
  const worker = new Worker(new URL("./pgWorker.mjs", import.meta.url));
  const lock = new Int32Array(new SharedArrayBuffer(4));
  let workerError: Error | undefined;
  worker.on("error", (error) => {
    workerError = error;
    Atomics.store(lock, 0, 1);
    Atomics.notify(lock, 0);
  });
  const call = (message: Record<string, unknown>) => {
    const channel = new MessageChannel();
    Atomics.store(lock, 0, 0);
    worker.postMessage({ ...message, port: channel.port2, lock: lock.buffer }, [channel.port2]);
    const status = Atomics.wait(lock, 0, 0, 30_000);
    if (workerError) throw workerError;
    if (status === "timed-out") throw new Error("Timed out waiting for PostgreSQL");
    const received = receiveMessageOnPort(channel.port1);
    if (!received) throw new Error("PostgreSQL worker returned no result");
    const body = received.message as { error?: string; rows?: Record<string, unknown>[] };
    if (body.error) throw new Error(body.error);
    return (body.rows ?? []).map((row) => normalizeRow(row));
  };
  const db: PostgresDatabase = {
    dialect: "postgres",
    query(sql, params) {
      return call({ type: "query", sql, params: params.map((value) => (value === undefined ? null : value)) });
    },
  };
  try {
    call({ type: "connect", connectionString });
  } catch (error) {
    void worker.terminate();
    const message = error instanceof Error ? error.message : "connection failed";
    throw new Error(`Could not open the PostgreSQL database from my_database (${connectionString.replace(/:[^:@/]+@/, ":***@")}). ${message}`);
  }
  seedPostgres(db);
  return db;
}

export function all<T extends object>(db: AppDatabase, sql: string, ...params: SQLInputValue[]): T[] {
  if (isPostgres(db)) return db.query(adaptSql(sql), params) as T[];
  return db.prepare(sql).all(...params).map((row) => ({ ...(row as object) })) as T[];
}

export function one<T extends object>(db: AppDatabase, sql: string, ...params: SQLInputValue[]): T | undefined {
  if (isPostgres(db)) return db.query(adaptSql(sql), params)[0] as T | undefined;
  const row = db.prepare(sql).get(...params);
  return row ? ({ ...(row as object) } as T) : undefined;
}

export function run(db: AppDatabase, sql: string, ...params: SQLInputValue[]) {
  if (isPostgres(db)) return db.query(adaptSql(sql), params);
  return db.prepare(sql).run(...params);
}
