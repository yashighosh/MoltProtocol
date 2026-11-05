# Billing rules for later traceability work

These notes are not loaded by the app. They map business-rule ids to the legacy billing sample.

| Id | Rule | File | Function |
| --- | --- | --- | --- |
| BR-B01 | Discount is applied before tax. | src/invoice/invoice.js | generateInvoice |
| BR-B02 | Tax is applied once per invoice. | src/invoice/reissue.js | reissueInvoice |
| BR-B03 | A receipt failure must not be discarded. | src/payments/payment.js | processPayment |
| BR-B04 | The rate table used by the legacy calculator must be present. | src/legacy/calc2.js | q |
| BR-B05 | Unfinished rate-branch work must be called out in the intent. | src/legacy/calc2.js | q |
| BR-B06 | Total discount is capped at 20 percent. The code caps only the loyalty part. | src/discounts/discount.js | applyDiscount |
| BR-B07 | An invoice needs an active customer and a total greater than zero. | src/invoice/validate.js | validateInvoice |
| BR-B08 | isPaid means the invoice is fully paid. | src/payments/status.js | isPaid |
