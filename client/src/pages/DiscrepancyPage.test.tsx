import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscrepancyPage } from "./DiscrepancyPage";
import type { Discrepancy } from "../types";

const items: Discrepancy[] = [
  {
    id: "d1",
    moduleId: "m1",
    moduleName: "billing/invoice.js",
    summaryId: "s1",
    ruleId: "discount-applied-after-tax",
    description: "The first tax call appears before the discount call.",
    codeExcerpt: "applyTax(amount); applyDiscount(amount);",
    intentText: "Apply the customer discount before tax.",
    startLine: 4,
    endLine: 8,
    severity: "high",
    impactScore: 0.95,
    impactRank: 1,
    factors: { severity: 1, centrality: 1, intentConfidence: 1 },
    status: "potential",
  },
  {
    id: "d2",
    moduleId: "m2",
    moduleName: "util/scratch.js",
    summaryId: "s2",
    ruleId: "unfinished-marker",
    description: "A TODO remains in the module.",
    codeExcerpt: "TODO: unknown",
    intentText: "No stated business purpose.",
    startLine: 1,
    endLine: 1,
    severity: "low",
    impactScore: 0.2,
    impactRank: 2,
    factors: { severity: 0.33, centrality: 0.1, intentConfidence: 0.45 },
    status: "potential",
  },
];

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/discrepancies/p1"]}>
      <Routes>
        <Route path="/discrepancies/:projectId" element={<DiscrepancyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DiscrepancyPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (path: string) => {
      if (String(path).endsWith("/discrepancies")) {
        return {
          ok: true,
          json: async () => ({
            items,
            message: "6 unreviewed summaries were excluded. Detection uses validated intent only.",
            discrepancyStatus: "complete",
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    }));
  });

  it("keeps impact order, filters by severity, and shows code beside intent", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("status")).toHaveTextContent(/6 unreviewed summaries were excluded/);
    const ranks = screen.getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(ranks[0]).toContain("billing/invoice.js");
    expect(ranks[1]).toContain("util/scratch.js");
    expect(screen.getByText("applyTax(amount); applyDiscount(amount);")).toBeInTheDocument();
    expect(screen.getByText("Apply the customer discount before tax.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Severity"), "low");
    expect(screen.queryByRole("button", { name: "billing/invoice.js" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "util/scratch.js" }));
    expect(screen.getByText("TODO: unknown")).toBeInTheDocument();
    expect(screen.getByText("No stated business purpose.")).toBeInTheDocument();
  });
});
