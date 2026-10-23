import { Upload } from "lucide-react";
import { useState } from "react";

export type IngestionMode = "upload" | "git";

export function IngestionChooser({
  busy,
  serverError,
  onUpload,
  onGit,
  onSample,
}: {
  busy: boolean;
  serverError: string;
  onUpload: (name: string, files: File[]) => void;
  onGit: (name: string, url: string) => void;
  onSample: (name: string) => void;
}) {
  const [mode, setMode] = useState<IngestionMode>("upload");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [hot, setHot] = useState(false);

  function validate(): string {
    if (!name.trim()) return "Enter a project name before submitting.";
    if (mode === "git") {
      if (!url.trim()) return "Enter a Git URL.";
      if (!url.trim().startsWith("https://")) return "The Git URL must start with https://. Local and non-https targets are rejected.";
    }
    if (mode === "upload" && files.length === 0) return "Choose a .zip archive or one or more source files.";
    const oversized = files.find((file) => file.size > 20 * 1024 * 1024);
    if (oversized) return `${oversized.name} exceeds the 20 MB upload limit.`;
    return "";
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const message = validate();
    setError(message);
    if (message) return;
    if (mode === "git") onGit(name.trim(), url.trim());
    else onUpload(name.trim(), files);
  }

  const ready = validate() === "";

  return (
    <form className="stack" onSubmit={submit}>
      <div className="segmented" role="group" aria-label="Ingestion source">
        <button type="button" aria-pressed={mode === "upload"} onClick={() => setMode("upload")}>Upload archive</button>
        <button type="button" aria-pressed={mode === "git"} onClick={() => setMode("git")}>Git URL</button>
      </div>
      <div className="row">
        <span className="chip">JavaScript</span>
        <span className="chip">TypeScript</span>
        <span className="chip">20 MB limit</span>
        <span className="chip">https only</span>
      </div>
      <p className="lead">
        Supported for parsing: JavaScript and TypeScript (.js, .jsx, .mjs, .cjs, .ts, .tsx). Other files are kept and flagged, not dropped.
        Zip uploads and clones are limited to 20 MB. Git URLs must be public https links on github.com, gitlab.com, or bitbucket.org. Nothing in the repository is executed.
      </p>
      <label>
        Project name
        <input value={name} onChange={(event) => setName(event.target.value)} name="projectName" autoComplete="off" />
      </label>
      {mode === "upload" ? (
        <div
          className={`dropzone${hot ? " hot" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setHot(true); }}
          onDragLeave={() => setHot(false)}
          onDrop={(event) => {
            event.preventDefault();
            setHot(false);
            setFiles([...event.dataTransfer.files]);
          }}
        >
          <Upload aria-hidden="true" />
          <strong>Drop a zip or source files</strong>
          <label>
            Archive or source files
            <input key="upload" type="file" name="files" multiple onChange={(event) => setFiles([...(event.target.files ?? [])])} />
          </label>
        </div>
      ) : (
        <label>
          Git URL
          <input key="git" value={url} onChange={(event) => setUrl(event.target.value)} name="gitUrl" placeholder="https://github.com/org/legacy" autoComplete="off" />
        </label>
      )}
      {files.length > 0 && mode === "upload" && (
        <p className="mono">{files.length} file{files.length === 1 ? "" : "s"} selected: {files.map((file) => file.name).join(", ")}</p>
      )}
      <p aria-live="polite">{ready ? "Ready to submit." : "Add the missing fields before submitting."}</p>
      {(error || serverError) && <p className="field-error" role="alert">{error || serverError}</p>}
      <div className="row">
        <button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit codebase"}</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => onSample(name.trim() || "Sample legacy billing")}>
          Load bundled sample
        </button>
      </div>
    </form>
  );
}
