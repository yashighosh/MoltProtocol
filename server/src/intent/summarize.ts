import type { ParsedSource } from "../analysis/parse.js";
import type { ConfidenceResult } from "./confidence.js";

export type EvidenceRef = {
  path: string;
  startLine: number;
  endLine: number;
  reason: string;
};

function humanize(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.(jsx|tsx|js|ts|mjs|cjs)$/, "").replace(/[-_]/g, " ");
}

export function buildDeterministicSummary(filePath: string, parsed: ParsedSource, importsDescribed: string[]): { text: string; evidence: EvidenceRef[] } {
  const functions = parsed.functions.map((fn) => fn.name).filter((name) => !name.startsWith("anonymous@"));
  const sentences = [
    `${humanize(filePath)} is read here as one module of the ingested codebase.`,
  ];
  if (parsed.commentText) {
    const quoted = parsed.commentText.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 4).join(" ");
    sentences.push(`Comments in the source say: "${quoted}"`);
  } else {
    sentences.push("The source has no comments that state a business purpose.");
  }
  if (functions.length) {
    sentences.push(`It defines ${functions.join(", ")}.`);
  }
  if (importsDescribed.length) {
    sentences.push(`It depends on ${importsDescribed.join(", ")}.`);
  }
  sentences.push("This is an inference from names, comments, and call structure. It is not a validated account of operational behavior.");

  const evidence: EvidenceRef[] = [];
  if (parsed.commentText) {
    evidence.push({ path: filePath, startLine: 1, endLine: Math.min(12, parsed.functions[0]?.startLine ?? 8), reason: "Leading comments used as intent language." });
  }
  for (const fn of parsed.functions.slice(0, 6)) {
    evidence.push({ path: filePath, startLine: fn.startLine, endLine: fn.endLine, reason: `Function ${fn.name} contributes to the structural reading.` });
  }
  if (evidence.length === 0) {
    evidence.push({ path: filePath, startLine: 1, endLine: 1, reason: "Entire file inspected; no functions or comments were found." });
  }
  return { text: sentences.join(" "), evidence };
}

export function confidenceSentence(result: ConfidenceResult): string {
  return `Confidence is ${result.level} (${result.score}) from comment coverage, naming, tests, complexity, and whether relative imports resolve.`;
}
