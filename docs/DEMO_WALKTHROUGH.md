# Demonstration walkthrough

About 8 to 10 minutes. Counts below were read from a live `POST /api/v1/demo/open` on 23 Oct 2026. If a reset has been used, the project id changes. The counts should not.

## Start

1. From the repository root, run `npm install`, then `npm run dev`.
2. Open http://127.0.0.1:5173.
3. Skip the opening sequence, or press Escape. It does not play again in the same tab.
4. Choose **Sign in as Ada**, or open **Sign in** and use `ada.okonkwo@moltprotocol.demo` / `demo-pass`. The chip reads **Signed in as Ada Okonkwo · Demo identity**.

## Open the demo

5. On the dashboard, choose **Open demo project** (also on the landing page and on Projects). The first run creates **Demonstration project** and the badge **Demonstration data**. A second click opens the same project.

Route: `/dashboard/<projectId>`.

Point at the stored counts. The dashboard cards read **Files parsed 8**, **Flagged files 3**, **Modules 8**, **Confirmed edges 10**, **Unresolved edges 4**, **Summaries 8**, **Validated 2**, **Discrepancies 4**. Ingest shows **11 files** in total (8 parsed plus 3 flagged) and **75 lines** on the parsed files. Confidence is **1 low, 5 medium, 2 high**. Validate stays **queued** because 6 summaries are still inferred.

## US1 Ingestion

6. Open `/ingestion/<projectId>`.

Point at `docs/overview.md` unsupported, `legacy/empty.js` empty, and `legacy/broken.js` syntax error. Each row has a reason. The stage list shows ingestion complete. Refresh the URL. The same files remain.

## US2 Dependency map

7. Open `/dependency-map/<projectId>`.

Point at a solid edge from `billing/invoice.js` to `billing/tax.js`, and a dashed edge for `../payments/ledger.js`, which is not in the ingest. Select `billing/invoice.js`. The side panel lists callers and callees. Use **Download SVG** or **Export PDF**. Refresh. The selection can be made again.

## US3 Intent summaries

8. Open `/intent-summaries/<projectId>`.

Filter **Low confidence**. `util/scratch.js` is low and still inferred. Open it. The evidence line range is on the summary, and the source lines are highlighted. Refresh. The low flag remains.

## US4 Validation

9. Open `/intent-review/<projectId>` while signed in as Ada.

`billing/invoice.js` is **confirmed** by **Ada Okonkwo**, **Demo identity**, with a time. The revision list contains the generated text and the confirmed text.

10. Sign out. Sign in as `ravi.shah@moltprotocol.demo` / `demo-pass`. Open the same review route.

`customers/account.js` is **corrected** by **Ravi Shah**. The generated revision keeps the previous text. The corrected revision reads: "Open an account and keep the contracted discount rate for billing." Six other summaries stay inferred, which is why compare reports **6 unreviewed summaries were excluded**.

## US5 Discrepancies

11. Open `/discrepancies/<projectId>`.

The table is ordered by impact rank. Rank 1 is high: validated intent says the discount is applied before tax, but the first tax call appears before the discount call, on `billing/invoice.js`. Rank 2 is high: `applyTax` is called 2 times inside `buildInvoice`. The row shows the code excerpt beside the validated intent. Refresh. The order stays.

## Recovery

12. On the dashboard, choose **Reset demo project** and confirm. Only the demonstration project is deleted. A project created with **Load sample only** or **New project** remains. **Open demo project** builds a new one.

## Not in this sprint

Architecture draft and Behavior checks are marked **Preview**. They do not run US6 to US10, and they do not show unlabeled counts.
