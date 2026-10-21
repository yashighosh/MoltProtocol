import { describe, expect, it } from "vitest";
import { classifyFile, countLoc } from "./classify.js";

describe("classifyFile", () => {
  it("counts non-empty lines and accepts JavaScript", () => {
    const result = classifyFile("billing/invoice.js", Buffer.from("const a = 1;\n\nconst b = 2;\n"));
    expect(result.status).toBe("parsed");
    expect(result.language).toBe("JavaScript");
    expect(result.loc).toBe(2);
    expect(countLoc("a\n\nb")).toBe(2);
  });

  it("flags an unsupported extension instead of dropping it", () => {
    const result = classifyFile("docs/overview.md", Buffer.from("# notes"));
    expect(result.status).toBe("unsupported");
    expect(result.rejectionReason).toMatch(/Unsupported format/);
  });

  it("flags an empty supported file as corrupted", () => {
    const result = classifyFile("legacy/empty.js", Buffer.alloc(0));
    expect(result.status).toBe("corrupted");
    expect(result.rejectionReason).toMatch(/empty/i);
  });

  it("flags binary content that wears a source extension", () => {
    const result = classifyFile("legacy/blob.js", Buffer.from([0x00, 0x61]));
    expect(result.status).toBe("corrupted");
    expect(result.rejectionReason).toMatch(/not valid text/i);
  });
});
