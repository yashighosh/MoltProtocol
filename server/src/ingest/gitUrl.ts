const ALLOWED_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "gitlab.com",
  "www.gitlab.com",
  "bitbucket.org",
  "www.bitbucket.org",
]);

export type GitUrlResult = { ok: true; href: string } | { ok: false; message: string };

function isIpAddress(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

export function validateGitUrl(raw: string): GitUrlResult {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Enter a full https Git URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, message: "Only public https Git URLs are accepted." };
  }
  if (url.username || url.password) {
    return { ok: false, message: "URLs that embed credentials are rejected." };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, message: "Internal and local hosts are rejected." };
  }
  if (isIpAddress(host)) {
    return { ok: false, message: "IP addresses are rejected. Use an allow-listed Git host name." };
  }
  if (!ALLOWED_HOSTS.has(host)) {
    return {
      ok: false,
      message: "Host is not allow-listed. Sprint 1 accepts github.com, gitlab.com, and bitbucket.org.",
    };
  }

  return { ok: true, href: url.toString() };
}
