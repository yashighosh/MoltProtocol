/**
 * Confidence is computed only from structural evidence in the ingested module.
 * It is not an LLM self-report. The same inputs always produce the same score.
 *
 * Weights:
 * - comment coverage 0.28 — comments are the strongest local statement of intent
 * - naming clarity 0.24 — opaque identifiers reduce how far a reader can trust a reading
 * - nearby test 0.18 — a test file is independent evidence that behavior was specified
 * - inverse complexity 0.15 — dense branching makes a single reading less reliable
 * - import resolution 0.15 — missing relative imports mean the module is incomplete here
 *
 * Bands: high >= 0.67, medium >= 0.40, otherwise low.
 */
export type ConfidenceLevel = "low" | "medium" | "high";

export type ConfidenceInput = {
  commentChars: number;
  codeChars: number;
  names: string[];
  hasTestFile: boolean;
  branchCount: number;
  functionCount: number;
  unresolvedRelativeImports: number;
};

export type ConfidenceResult = {
  level: ConfidenceLevel;
  score: number;
  rationale: Record<string, number>;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function namingClarity(names: string[]): number {
  const useful = names.filter((name) => name && !name.startsWith("anonymous@"));
  if (useful.length === 0) return 0.35;
  const scores: number[] = useful.map((name) => {
    if (name.length <= 2) return 0;
    if (!/[aeiou]/i.test(name)) return 0.15;
    if (/[A-Z]/.test(name) && /[a-z]/.test(name)) return 1;
    if (name.includes("_") && name.length >= 5) return 0.85;
    if (name.length >= 8) return 0.8;
    if (name.length >= 5) return 0.6;
    return 0.4;
  });
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function scoreConfidence(input: ConfidenceInput): ConfidenceResult {
  const commentCoverage = clamp(input.commentChars / Math.max(input.codeChars, 1));
  const naming = namingClarity(input.names);
  const tests = input.hasTestFile ? 1 : 0;
  const complexityBudget = Math.max(input.functionCount, 1) * 4;
  const complexity = 1 - clamp(input.branchCount / complexityBudget);
  const resolution = input.unresolvedRelativeImports === 0 ? 1 : clamp(1 - input.unresolvedRelativeImports / 3);

  const rationale = {
    commentCoverage: round(commentCoverage),
    namingClarity: round(naming),
    testPresence: tests,
    inverseComplexity: round(complexity),
    importResolution: round(resolution),
  };
  const score = round(
    0.28 * commentCoverage + 0.24 * naming + 0.18 * tests + 0.15 * complexity + 0.15 * resolution,
  );
  const level: ConfidenceLevel = score >= 0.67 ? "high" : score >= 0.4 ? "medium" : "low";
  return { level, score, rationale };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
