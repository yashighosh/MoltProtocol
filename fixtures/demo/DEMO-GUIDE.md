# Demo guide

These steps were run against the local API on this machine. Numbers below are the ones that run returned.

## Archives

- Billing: `/Users/yashighosh/MoltProtocol/fixtures/demo/billing-legacy.zip` (7948 bytes, 12 entries)
- Inventory: `/Users/yashighosh/MoltProtocol/fixtures/demo/inventory-legacy.zip` (7675 bytes, 13 entries)

Both archives store the sample contents at the zip root (`README.md`, `src/...`, and for inventory `config/warehouses.json`). The ingest path keeps those paths as written. It does not strip a wrapping folder. Rebuild them with `npm run build:demo-zips` from the repo root.

## Start and sign in

From `/Users/yashighosh/MoltProtocol`:

```
npm run dev
```

The web app is `http://localhost:5173`. The API is `http://localhost:4000`.

Sign in as `ada.okonkwo@moltprotocol.demo` / `demo-pass`. The recorded reviewer name is Ada Okonkwo.

## Billing sample

1. Open **Ingest**.
2. Leave the mode on **Upload archive**.
3. Project name: `Legacy billing`.
4. Choose `/Users/yashighosh/MoltProtocol/fixtures/demo/billing-legacy.zip`.
5. **Submit codebase**.
6. When ingestion is complete, **Proceed to dependency analysis**, then **Run dependency analysis**.
7. Open **Intent summaries** and **Generate intent summaries**.
8. Open each module below and **Send to expert review**.
9. Open **Expert review**, select the module, and **Confirm as accurate**.
10. Open **Discrepancies** and **Run discrepancy detection**.

Ingestion recorded 12 files, 11 parsed as JavaScript, 1 rejected. The only flagged file is `README.md` (unsupported `.md`).

Confirm these four summaries as written. Do not rewrite them.

| Module | Observed band | Why this one |
| --- | --- | --- |
| `src/invoice/invoice.js` | medium 0.442 | The generated text already quotes "Discount is applied before tax." |
| `src/invoice/reissue.js` | medium 0.542 | The generated text already says tax is applied once per invoice. |
| `src/payments/payment.js` | medium 0.518 | Empty catch around the receipt send. |
| `src/legacy/calc2.js` | low 0.304 | Missing `./old_rates.js` and a TODO after the quoted comments. |

`src/tax/tax.js` landed high (0.79). `src/legacy/calc2.js` landed low. The other parsed modules landed medium. `src/tax/tax.test.js` itself landed low (0.396). Its import of `node:assert/strict` is an external package edge, not a missing file.

Confirmed import edges: invoice to tax, discount, validate, and customer; reissue to tax and invoice; payment to status and invoice; customer to ids. `src/legacy/calc2.js` has an unresolved import and call to `missing:./old_rates.js` with detail "missing file".

After the four confirms, detection stored five findings, highest impact first:

1. `discount-applied-after-tax` on `src/invoice/invoice.js` (high, 0.95)
2. `tax-applied-more-than-once` on `src/invoice/reissue.js` (high, 0.742)
3. `empty-catch` on `src/payments/payment.js` (medium, 0.595)
4. `unresolved-dependency` on `src/legacy/calc2.js` (medium, 0.466)
5. `unfinished-marker` on `src/legacy/calc2.js` (low, 0.301)

The 20 percent discount cap, the missing invoice checks, and the 90 percent `isPaid` cutoff are written into the source as narrative only. The detector does not flag them.

## Inventory sample

Repeat the same click path with project name `Legacy inventory` and `/Users/yashighosh/MoltProtocol/fixtures/demo/inventory-legacy.zip`.

Ingestion recorded 13 files, 11 parsed as TypeScript, 2 rejected. Flagged files, and only these:

- `config/warehouses.json` unsupported
- `src/legacy/label_printer.js` corrupted, language JavaScript, reason `Syntax error: Identifier expected.`

Confirm these two summaries as written:

| Module | Observed band | Why this one |
| --- | --- | --- |
| `src/shipping/shipment.ts` | medium 0.516 | Empty catch, and an import of `../legacy/barcode` that is not in the archive. |
| `src/orders/order.ts` | medium 0.558 | TODO for backorder handling. The quoted summary lines do not contain that TODO. |

`src/inventory/stock.ts` landed high (0.714). `src/inventory/adj2.ts` landed low (0.198).

Confirmed import edges: order to warehouse, reservation, and product; cancel to reservation and order; shipment to carrier and order; reservation to stock. Reservation also calls the warehouse module, so that extra confirmed edge is present. Shipment has an unresolved import and call to `missing:../legacy/barcode` with detail "missing file".

After the two confirms, detection stored three findings:

1. `empty-catch` on `src/shipping/shipment.ts` (medium, 0.66)
2. `unresolved-dependency` on `src/shipping/shipment.ts` (medium, 0.66)
3. `unfinished-marker` on `src/orders/order.ts` (low, 0.615)

The first two share an impact score. The list is ordered by that score.

Three of the five detector rules can fire in this domain. `discount-applied-after-tax` and `tax-applied-more-than-once` did not appear, and this sample has no tax or discount code. The reorder threshold, the "nearest warehouse" comment, and the "no cancel after shipment" comment are narrative only.

## Not demonstrable yet

The sidebar links for Architecture, Rule preservation, Behavior testing, Compliance and traceability, and Leadership view are present in the client. Those screens wait on server routes that are not implemented. The database has no tables for proposals, rule checks, behavior runs, or leadership records. `GET /api/v1/projects/:projectId/traceability` is the earlier review matrix, not a compliance ledger.

`fixtures/demo/rules/billing-rules.md` (`BR-B01` onward) and `fixtures/demo/rules/inventory-rules.md` (`BR-I01` onward) are reference notes for later work. They are not inside the zips and the app does not read them.
