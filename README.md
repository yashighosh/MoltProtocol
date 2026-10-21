# MoltProtocol

Intent-aware workbench for legacy modernization. Sprint 1 covers ingestion, a dependency map, intent summaries with confidence, expert validation, and discrepancy detection.

Inference is not sign-off. A summary stays labeled inferred until a persisted reviewer confirms or corrects it.

## Run

```bash
npm install
npm test
npm run dev
```

Open http://localhost:5173. The API listens on http://localhost:4000 and the Vite dev server proxies `/api`.

Demo sign-in (labeled **Demo identity** in the shell and on every review):

- `ada.okonkwo@moltprotocol.demo` / `demo-pass`
- `ravi.shah@moltprotocol.demo` / `demo-pass`

On Ingestion, use **Load bundled sample**. The fixture is `fixtures/sample-legacy`. It is a small billing codebase with one unsupported file, one empty file, one syntax error, one low-confidence module, and structural mismatches in `billing/invoice.js`.

## Walkthrough

1. `/` plays a skippable opening once per session. Reduced motion skips it.
2. Sign in. The same identity is what expert review will record.
3. Sign-in opens `/dashboard`. `/workspace` lists projects. The sidebar also reaches progress, rule check, architecture draft, behavior checks, traceability, reports, and settings.
4. `/ingestion/:projectId` shows stages, then file count, languages, lines of code, and flagged files.
5. `/dependency-map/:projectId` runs analysis, selects a node, and exports SVG, PNG, or PDF.
6. `/intent-summaries/:projectId` generates summaries. `util/scratch.js` is low confidence and stays flagged. Send a summary to review.
7. `/intent-review/:projectId` confirms one summary and corrects another. Revision history keeps the previous text.
8. `/discrepancies/:projectId` compares only validated intent. Unreviewed modules are reported as excluded, not hidden.

## Decisions for this empty repository

The event diagram described React, Express, Redis, BullMQ, and MySQL. None of that existed. Sprint 1 uses:

- Vite, React, and React Router. Not Next.js.
- Express under `/api/v1`.
- SQLite through Node's built-in `node:sqlite`, in `data/molt.sqlite`.
- A job table and status polling. Redis and BullMQ are not introduced.
- A labeled demo sign-in with two persisted users. There is no free-text reviewer name.
- Deterministic summaries unless `MOLT_LLM_ENABLED=true` and `OPENAI_API_KEY` are both set. Confidence is never taken from the model. See `METHODOLOGY.md`.
- JavaScript and TypeScript only. Other files are stored and flagged.
- Discrepancy detection waits for validated intent.

US6 through US10 are not implemented.

## Limits

- Parsing does not execute the codebase and does not follow package dependencies outside the ingest.
- Git clones are https-only, allow-listed to github.com, gitlab.com, and bitbucket.org, depth 1, 25 seconds, 20 MB, with hooks disabled.
- Zip archives are rejected for path traversal, zip-bomb ratios, and size before extraction.
- Live model access is off in the demo. Summaries say so.
