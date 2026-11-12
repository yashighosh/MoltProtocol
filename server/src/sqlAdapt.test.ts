import { describe, expect, it } from "vitest";
import { adaptSql, normalizeValue } from "./sqlAdapt.js";

describe("postgres sql adaptation", () => {
  it("casts jsonb columns and boolean literals while numbering placeholders", () => {
    const sql = adaptSql(`INSERT INTO intent_summaries (
      id, project_id, module_id, text, confidence, confidence_score, rationale_json, evidence_json,
      source_hash, mode, status, queued_for_review, source_drift, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inferred', 0, 0, ?)`);
    expect(sql).toContain("rationale_json, evidence_json");
    expect(sql).toContain("$7::jsonb, $8::jsonb");
    expect(sql).toContain("'inferred', FALSE, FALSE, $11");
    expect(sql.match(/\$\d+/g)).toHaveLength(11);
  });

  it("rewrites boolean comparisons and update assignments", () => {
    const sql = adaptSql("UPDATE intent_summaries SET rationale_json = ?, source_drift = 0, queued_for_review = 1 WHERE id = ?");
    expect(sql).toBe("UPDATE intent_summaries SET rationale_json = $1::jsonb, source_drift = FALSE, queued_for_review = TRUE WHERE id = $2");
  });

  it("turns postgres values into the shapes the rest of the app already reads", () => {
    expect(normalizeValue(true)).toBe(1);
    expect(normalizeValue(false)).toBe(0);
    expect(normalizeValue(new Date("2026-11-12T00:00:00.000Z"))).toBe("2026-11-12T00:00:00.000Z");
    expect(normalizeValue({ score: 1 })).toBe('{"score":1}');
    expect(normalizeValue("12")).toBe(12);
    expect(normalizeValue("user-ada")).toBe("user-ada");
  });
});
