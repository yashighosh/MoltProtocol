# Requirement to code

Checked 21 Oct 2026. The GitHub repository and this folder had no application code before this sprint. Evidence below is the implementation that now satisfies each acceptance criterion.

| Story | Criterion | Implementation | Tests |
| --- | --- | --- | --- |
| US1 | Supported codebase returns a summary of files, languages, and LOC | `server/src/pipeline.ts` `runIngestion`, `projectPayload`; `client/src/pages/IngestionPage.tsx` | `server/test/api.test.ts` |
| US1 | Unsupported or corrupted files are flagged | `server/src/ingest/classify.ts`; syntax failures in `insertFile` | `classify.test.ts`, API sample assertions for `.md`, empty, and broken files |
| US1 | Current stage is visible while ingestion runs | `ingestion_events` and the stage list on the ingestion page | API test asserts a `parsing` stage |
| US2 | Modules and dependency/call edges after ingestion | `runAnalysis`, `graphPayload`; `client/src/components/GraphCanvas.tsx` | API test asserts invoice → tax confirmed and a missing-file edge |
| US2 | Selected node shows callers and callees | `moduleDetail`; dependency page aside; graph nodes are buttons | API test on the invoice module; `GraphCanvas.test.tsx` |
| US2 | Export image or PDF | `server/src/export/graphExport.ts`; graph page PNG/PDF/SVG actions | `graphExport.test.ts`, API svg/pdf test |
| US3 | Plain-language summary with low/medium/high confidence | `server/src/intent/confidence.ts`, `summarize.ts`, `llm.ts` | `confidence.test.ts`; API asserts scratch is low and account is not |
| US3 | Low confidence is flagged for review | `client/src/components/IntentSummaryView.tsx` | `IntentSummaryView.test.tsx` |
| US3 | Source sections are shown | evidence ranges plus highlighted source on the intent page | API asserts invoice evidence is non-empty |
| US3 | Unchanged source is not regenerated | hash check in `runSummaries` | API asserts `generatedAt` is unchanged on the second run |
| US4 | A summary can be confirmed | `confirmSummary`; review page | API confirm assertion |
| US4 | A correction stores reviewer identity | `correctSummary`, `intent_revisions`; demo session user | API asserts Ada Okonkwo, Demo identity, timestamp, revision actions |
| US4 | Downstream views show who reviewed it | `IntentSummaryView` reviewer line; summary payload | API summary detail after confirm |
| US5 | Discrepancies are flagged against validated intent | `server/src/discrepancy/compare.ts`; blocked when nothing is validated | API blocked state, then `discount-applied-after-tax` |
| US5 | Code and intent are shown together | discrepancy page detail panel | API asserts excerpt and intent text |
| US5 | List is ordered by impact | `rankFindings`; discrepancy page keeps that order and filters it | API asserts scores are sorted descending; `compare.test.ts`; `DiscrepancyPage.test.tsx` |

Security cases for ingestion: `gitUrl.test.ts`, `zipSafe.test.ts`, and the API traversal/private-host test.

US6–US10 have no routes, tables, or navigation entries.
