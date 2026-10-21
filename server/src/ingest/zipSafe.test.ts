import { describe, expect, it } from "vitest";
import { assessEntries, isUnsafeZipPath, readZip, storedZip } from "./zipSafe.js";

describe("zip safety", () => {
  it("rejects path traversal and oversized entries before extraction", () => {
    expect(isUnsafeZipPath("../etc/passwd")).toBe(true);
    expect(isUnsafeZipPath("billing/invoice.js")).toBe(false);
    expect(assessEntries([{ name: "../etc/passwd", compressedSize: 10, uncompressedSize: 10 }]).ok).toBe(false);
    const huge = assessEntries([{ name: "big.js", compressedSize: 10, uncompressedSize: 50_000_000 }]);
    expect(huge.ok).toBe(false);
    const bomb = assessEntries([{ name: "bomb.js", compressedSize: 10, uncompressedSize: 10_000 }], { maxCompressionRatio: 80, maxSingleFileBytes: 20_000, maxUncompressedBytes: 20_000 });
    expect(bomb.ok).toBe(false);
    if (!bomb.ok) expect(bomb.reason).toMatch(/zip bomb/i);
  });

  it("does not extract a traversal archive", () => {
    const buffer = storedZip([{ name: "../evil.txt", data: "nope" }, { name: "ok.js", data: "export const a = 1;\n" }]);
    const result = readZip(buffer);
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/path traversal/i);
  });
});
