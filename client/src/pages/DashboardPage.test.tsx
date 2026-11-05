import { describe, expect, it } from "vitest";
import { reviewStage } from "./DashboardPage";

const base = {
  statuses: { ingestion: "complete", analysis: "complete", summary: "complete", discrepancy: "blocked" },
  validatedByExperts: 1,
  unreviewed: 10,
  reviewQueued: 0,
};

describe("dashboard review stage", () => {
  it("does not call a partial validation queued when nothing is in the review queue", () => {
    expect(reviewStage(base)).toEqual({
      status: "attention",
      detail: "1 validated. 10 still inferred and not queued.",
    });
  });

  it("uses queued only for summaries actually waiting in expert review", () => {
    expect(reviewStage({ ...base, reviewQueued: 2 }).status).toBe("queued");
  });
});
