import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSource } from "../analysis/parse.js";
import { findDiscrepancies, impactScore, rankFindings } from "./compare.js";

describe("discrepancy comparison and ranking", () => {
  it("flags the known billing mismatches and orders severe central conflicts first", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "../../../fixtures/sample-legacy/billing/invoice.js"), "utf8");
    const parsed = parseSource("billing/invoice.js", source);
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    const findings = findDiscrepancies({
      intentText: parsed.commentText,
      source,
      missingRelativeImports: ["../payments/ledger.js"],
      emptyCatches: parsed.emptyCatches,
      duplicateCalls: parsed.duplicateCalls,
      todos: parsed.todos,
    });
    const rules = findings.map((finding) => finding.ruleId);
    expect(rules).toContain("discount-applied-after-tax");
    expect(rules).toContain("tax-applied-more-than-once");
    expect(rules).toContain("empty-catch");
    expect(rules).toContain("unresolved-dependency");

    const ranked = rankFindings([
      { id: "low", impactScore: impactScore("low", 0.1, "low").score },
      { id: "high", impactScore: impactScore("high", 0.9, "high").score },
    ]);
    expect(ranked[0].id).toBe("high");
    expect(ranked[0].impactRank).toBe(1);
    expect(ranked[0].impactScore).toBeGreaterThanOrEqual(ranked[1].impactScore);
  });
});
