import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RuleCheckPage } from "./RuleCheckPage";

vi.mock("../connection/modernize", () => ({
  listRuleChecks: vi.fn(async () => ({
    items: [{ id: "run-1", label: "Proposal v1", stale: false }],
    nextCursor: null,
  })),
  getRuleCheck: vi.fn(async () => ({
    runId: "run-1",
    architectureLabel: "Proposal v1",
    architectureVersionId: "ver-1",
    stale: false,
    staleReason: null,
    counts: { preserved: 0, mentionedOnly: 0, distorted: 1, dropped: 1, retired: 0, notInScope: 0 },
    rows: [
      {
        id: "row-dropped",
        ruleId: "rule-1",
        ruleKey: "BR-0001",
        statement: "Tax is rounded after the discount.",
        status: "dropped",
        componentKey: null,
        componentName: null,
        reason: "No component carries this rule.",
        responsibility: null,
        sourcePath: "billing/tax.js",
      },
      {
        id: "row-distorted",
        ruleId: "rule-2",
        ruleKey: "BR-0002",
        statement: "Discount applies before tax.",
        status: "distorted",
        componentKey: "billing",
        componentName: "Billing",
        reason: "The order is reversed.",
        responsibility: "Apply tax, then discount.",
        sourcePath: "billing/invoice.js",
      },
    ],
  })),
}));

describe("Rule preservation", () => {
  it("keeps dropped and distorted apart and does not mark a dropped rule preserved", async () => {
    render(
      <MemoryRouter initialEntries={["/rule-check/project-1"]}>
        <Routes>
          <Route path="/rule-check/:projectId/:runId?" element={<RuleCheckPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const dropped = await screen.findByText("BR-0001");
    expect(dropped.closest("tr")).toHaveTextContent("dropped");
    expect(dropped.closest("tr")).not.toHaveTextContent(/preserved/i);
    expect(screen.getByText("BR-0002").closest("tr")).toHaveTextContent("distorted");
  });
});
