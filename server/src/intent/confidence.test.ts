import { describe, expect, it } from "vitest";
import { scoreConfidence } from "./confidence.js";

describe("scoreConfidence", () => {
  it("is deterministic and ranks strong evidence above opaque code", () => {
    const strong = {
      commentChars: 400,
      codeChars: 500,
      names: ["openAccount", "discountRate"],
      hasTestFile: true,
      branchCount: 1,
      functionCount: 2,
      unresolvedRelativeImports: 0,
    };
    const weak = {
      commentChars: 0,
      codeChars: 80,
      names: ["f", "a", "b"],
      hasTestFile: false,
      branchCount: 0,
      functionCount: 1,
      unresolvedRelativeImports: 2,
    };
    const first = scoreConfidence(strong);
    const second = scoreConfidence(strong);
    expect(first).toEqual(second);
    expect(first.level).toBe("high");
    expect(scoreConfidence(weak).level).toBe("low");
    expect(first.score).toBeGreaterThan(scoreConfidence(weak).score);
  });
});
