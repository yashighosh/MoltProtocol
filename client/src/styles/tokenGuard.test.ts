import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(css|tsx|ts)$/.test(name) ? [full] : [];
  });
}

describe("design tokens", () => {
  it("keeps raw colours and radii in the tokens file", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const allowed = new Set([
      path.join(root, "styles/tokens.css"),
      path.join(root, "styles/contrast.test.ts"),
      path.join(root, "styles/tokenGuard.test.ts"),
    ]);
    const colour = /(?<![\w-])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/g;
    const radius = /border-radius:\s*\d/;
    const hits: string[] = [];
    for (const file of files(root)) {
      if (allowed.has(file)) continue;
      const text = readFileSync(file, "utf8");
      if (colour.test(text)) hits.push(`${path.relative(root, file)} colour`);
      colour.lastIndex = 0;
      if (file.endsWith(".css") && radius.test(text)) hits.push(`${path.relative(root, file)} radius`);
    }
    expect(hits).toEqual([]);
  });
});
