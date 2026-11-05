/**
 * An invoice needs an ACTIVE customer and a total greater than zero.
 * The implementation checks that items exist and that each quantity is positive.
 * It does not read customer status and it does not reject a non-positive unit price.
 */
export function validateInvoice(invoice) {
  if (!invoice.items || invoice.items.length === 0) {
    return { ok: false, reason: "items required" };
  }
  for (const item of invoice.items) {
    if (!(item.quantity > 0)) {
      return { ok: false, reason: "quantity must be positive" };
    }
  }
  return { ok: true };
}
