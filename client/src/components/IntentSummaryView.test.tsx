import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntentSummaryView } from "./IntentSummaryView";
import type { IntentSummary } from "../types";

const summary: IntentSummary = {
  id: "s1",
  projectId: "p1",
  moduleId: "m1",
  moduleName: "util/scratch.js",
  text: "scratch has no comments that state a business purpose.",
  confidence: "low",
  confidenceScore: 0.31,
  rationale: {},
  evidence: [{ path: "util/scratch.js", startLine: 1, endLine: 1, reason: "Entire file inspected." }],
  mode: "deterministic",
  status: "inferred",
  queuedForReview: false,
  reviewerName: null,
  reviewedAt: null,
  identityLabel: null,
  sourceDrift: false,
  generatedAt: "2026-10-21T00:00:00.000Z",
};

describe("IntentSummaryView", () => {
  it("shows the low-confidence warning and the source range", () => {
    render(<IntentSummaryView summary={summary} />);
    expect(screen.getByText(/Manual review required/)).toBeInTheDocument();
    expect(screen.getByText(/low confidence/)).toBeInTheDocument();
    expect(screen.getByText(/util\/scratch.js:1-1/)).toBeInTheDocument();
    expect(screen.getByText(/Demonstration mode/)).toBeInTheDocument();
  });
});
