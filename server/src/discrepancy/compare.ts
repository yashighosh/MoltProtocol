import type { ConfidenceLevel } from "../intent/confidence.js";

/**
 * These rules compare static evidence with validated intent text.
 * They flag potential discrepancies for review. They do not prove a runtime defect.
 */
export type Severity = "high" | "medium" | "low";

export type CompareInput = {
  intentText: string;
  source: string;
  missingRelativeImports: string[];
  emptyCatches: { line: number }[];
  duplicateCalls: { functionName: string; callee: string; count: number; line: number }[];
  todos: { line: number; text: string }[];
};

export type Finding = {
  ruleId: string;
  severity: Severity;
  description: string;
  excerpt: string;
  startLine: number;
  endLine: number;
};

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 1, medium: 0.66, low: 0.33 };
const CONFIDENCE_WEIGHT: Record<ConfidenceLevel, number> = { high: 1, medium: 0.75, low: 0.45 };

export function findDiscrepancies(input: CompareInput): Finding[] {
  const findings: Finding[] = [];
  const intent = input.intentText;

  if (/discount[\s\S]{0,80}before[\s\S]{0,40}tax/i.test(intent)) {
    const taxAt = input.source.search(/\b(applyTax|calculateTax)\b/);
    const discountAt = input.source.search(/\b(applyDiscount|calculateDiscount)\b/);
    if (taxAt !== -1 && discountAt !== -1 && taxAt < discountAt) {
      findings.push({
        ruleId: "discount-applied-after-tax",
        severity: "high",
        description: "Validated intent says the discount is applied before tax, but the first tax call appears before the discount call. This is a static order mismatch, not a proof of the runtime total.",
        excerpt: excerptAround(input.source, taxAt),
        startLine: lineAt(input.source, taxAt),
        endLine: lineAt(input.source, discountAt),
      });
    }
  }

  if (/\b(exactly once|only once|applied once|a single time)\b/i.test(intent)) {
    for (const call of input.duplicateCalls) {
      if (/tax/i.test(call.callee)) {
        findings.push({
          ruleId: "tax-applied-more-than-once",
          severity: "high",
          description: `${call.callee} is called ${call.count} times inside ${call.functionName}, while the validated intent says the operation happens once. Static call count is not a full execution trace.`,
          excerpt: excerptLine(input.source, call.line),
          startLine: call.line,
          endLine: call.line,
        });
      }
    }
  }

  for (const entry of input.emptyCatches) {
    findings.push({
      ruleId: "empty-catch",
      severity: "medium",
      description: "An empty catch swallows an error. The validated intent does not describe error suppression. Static review cannot tell whether the swallow is deliberate.",
      excerpt: excerptLine(input.source, entry.line),
      startLine: entry.line,
      endLine: entry.line,
    });
  }

  for (const specifier of input.missingRelativeImports) {
    findings.push({
      ruleId: "unresolved-dependency",
      severity: "medium",
      description: `Relative import "${specifier}" does not resolve to a file in this ingest. Behavior that depends on it cannot be checked. This is missing source, not a confirmed runtime failure.`,
      excerpt: specifier,
      startLine: 1,
      endLine: 1,
    });
  }

  if (!/\b(TODO|FIXME|HACK|incomplete|not finished)\b/i.test(intent)) {
    for (const todo of input.todos) {
      findings.push({
        ruleId: "unfinished-marker",
        severity: "low",
        description: "The source is marked unfinished, and the validated intent does not mention that incomplete work. The marker may be stale.",
        excerpt: todo.text,
        startLine: todo.line,
        endLine: todo.line,
      });
    }
  }

  return findings;
}

export function impactScore(severity: Severity, centrality: number, confidence: ConfidenceLevel): { score: number; factors: Record<string, number> } {
  const factors = {
    severity: SEVERITY_WEIGHT[severity],
    centrality: Math.max(0, Math.min(1, centrality)),
    intentConfidence: CONFIDENCE_WEIGHT[confidence],
  };
  const score = Math.round((0.5 * factors.severity + 0.3 * factors.centrality + 0.2 * factors.intentConfidence) * 1000) / 1000;
  return { score, factors };
}

/**
 * Impact is higher when a severe static mismatch sits in a central module
 * whose validated intent is itself high confidence. Low-confidence intent
 * lowers the rank because the conflict is less firmly specified.
 * Rank 1 is the highest score. Ties keep the incoming order.
 */
export function rankFindings<T extends { impactScore: number }>(items: T[]): (T & { impactRank: number })[] {
  const sorted = [...items].sort((a, b) => b.impactScore - a.impactScore);
  return sorted.map((item, index) => ({ ...item, impactRank: index + 1 }));
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function excerptAround(source: string, index: number): string {
  const line = lineAt(source, index);
  return excerptLine(source, line);
}

function excerptLine(source: string, line: number): string {
  const rows = source.split(/\r?\n/);
  const start = Math.max(0, line - 2);
  return rows.slice(start, Math.min(rows.length, line + 1)).join("\n");
}
