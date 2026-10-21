/**
 * Sprint 1 parses JavaScript and TypeScript only.
 * Other files are stored and flagged. They are never dropped silently.
 */
const LANGUAGE_BY_EXT: Record<string, string> = {
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
};

export type ClassifiedFile = {
  language: string | null;
  status: "parsed" | "unsupported" | "corrupted";
  rejectionReason: string | null;
  text: string | null;
  loc: number;
};

export function extensionOf(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  const index = base.lastIndexOf(".");
  return index <= 0 ? "" : base.slice(index).toLowerCase();
}

export function countLoc(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

export function classifyFile(filePath: string, bytes: Buffer): ClassifiedFile {
  const ext = extensionOf(filePath);
  const language = LANGUAGE_BY_EXT[ext] ?? null;

  if (!language) {
    const label = ext || "no extension";
    return {
      language: null,
      status: "unsupported",
      rejectionReason: `Unsupported format (${label}). Sprint 1 parses JavaScript and TypeScript only.`,
      text: null,
      loc: 0,
    };
  }

  if (bytes.length === 0) {
    return {
      language,
      status: "corrupted",
      rejectionReason: "File is empty.",
      text: null,
      loc: 0,
    };
  }

  if (bytes.includes(0)) {
    return {
      language,
      status: "corrupted",
      rejectionReason: "File is not valid text (binary content).",
      text: null,
      loc: 0,
    };
  }

  const text = bytes.toString("utf8");
  return {
    language,
    status: "parsed",
    rejectionReason: null,
    text,
    loc: countLoc(text),
  };
}

export const SUPPORTED_LANGUAGE_NOTE =
  "Supported for structural parsing: JavaScript and TypeScript (.js, .jsx, .mjs, .cjs, .ts, .tsx). Other formats are flagged and excluded from the dependency map and intent summary.";
