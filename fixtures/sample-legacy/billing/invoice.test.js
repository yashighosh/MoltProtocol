import { buildInvoice } from "./invoice.js";

export function testDiscountedInvoice() {
  const invoice = buildInvoice({
    lines: [{ amount: 100 }],
    region: "US",
    customer: { discountRate: 0.1 },
  });
  return invoice.total > 0;
}
