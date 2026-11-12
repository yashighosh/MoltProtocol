const JSONB_COLUMNS = new Set(["rationale_json", "evidence_json", "factors_json"]);
const BOOLEAN_COLUMNS = new Set(["queued_for_review", "source_drift", "is_demo", "is_active", "llm_allowed"]);

export function adaptSql(sql: string): string {
  let next = sql;
  next = next.replace(/\bqueued_for_review\s*=\s*1\b/g, "queued_for_review = TRUE");
  next = next.replace(/\bqueued_for_review\s*=\s*0\b/g, "queued_for_review = FALSE");
  next = next.replace(/\bsource_drift\s*=\s*1\b/g, "source_drift = TRUE");
  next = next.replace(/\bsource_drift\s*=\s*0\b/g, "source_drift = FALSE");
  for (const column of JSONB_COLUMNS) {
    next = next.replace(new RegExp(`\\b${column}\\s*=\\s*\\?`, "g"), `${column} = ?::jsonb`);
  }
  next = next.replace(/INSERT INTO\s+(\w+)\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/gi, (_full, table: string, cols: string, vals: string) => {
    const columns = cols.split(",").map((column) => column.trim());
    const values = vals.split(",");
    if (columns.length !== values.length) return `INSERT INTO ${table} (${cols}) VALUES (${vals})`;
    const rewritten = values.map((value, index) => {
      const column = columns[index] ?? "";
      const trimmed = value.trim();
      if (BOOLEAN_COLUMNS.has(column) && trimmed === "0") return "FALSE";
      if (BOOLEAN_COLUMNS.has(column) && trimmed === "1") return "TRUE";
      if (JSONB_COLUMNS.has(column) && trimmed === "?") return "?::jsonb";
      return value.trim();
    });
    return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${rewritten.join(", ")})`;
  });
  let index = 0;
  next = next.replace(/\?/g, () => `$${++index}`);
  return next;
}

export function normalizeValue(value: unknown): unknown {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object" && value.constructor === Object) return JSON.stringify(value);
  if (typeof value === "string" && /^-?\d+$/.test(value) && value.length < 16) return Number(value);
  return value;
}

export function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) normalized[key] = normalizeValue(value);
  return normalized;
}
