import { describe, expect, it } from "vitest";
import { validateGitUrl } from "./gitUrl.js";

describe("validateGitUrl", () => {
  it("accepts public https hosts on the allow list", () => {
    expect(validateGitUrl("https://github.com/example/legacy.git").ok).toBe(true);
    expect(validateGitUrl("https://gitlab.com/group/repo").ok).toBe(true);
  });

  it("rejects local, link-local, and non-https targets", () => {
    for (const url of [
      "http://127.0.0.1/repo.git",
      "https://127.0.0.1/repo.git",
      "https://169.254.169.254/latest",
      "https://localhost/repo.git",
      "file:///etc/passwd",
      "git@github.com:example/repo.git",
      "https://user:token@github.com/example/repo.git",
      "https://example.com/repo.git",
    ]) {
      const result = validateGitUrl(url);
      expect(result.ok, url).toBe(false);
    }
  });
});
