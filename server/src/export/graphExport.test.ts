import { describe, expect, it } from "vitest";
import { buildGraphSvg, buildPdf } from "./graphExport.js";

describe("graph export", () => {
  it("produces a non-empty svg and a readable pdf", () => {
    const svg = buildGraphSvg(
      [{ id: "a", name: "billing/invoice.js", kind: "file", directory: "billing" }, { id: "b", name: "billing/tax.js", kind: "file", directory: "billing" }],
      [{ from: "a", to: "b", relationship: "import", resolution: "confirmed" }],
    );
    expect(svg).toContain("<svg");
    expect(svg).toContain("invoice.js");
    const pdf = buildPdf(["MoltProtocol dependency map", "confirmed import: billing/invoice.js -> billing/tax.js"]);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString()).toContain("billing/invoice.js");
    expect(pdf.length).toBeGreaterThan(200);
  });
});
