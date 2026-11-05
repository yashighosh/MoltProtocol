/**
 * Payments move pending, then partially paid, then paid, then refunded.
 * isPaid is described as fully paid.
 * The function returns true when the amount covers 90 percent of the total.
 */
export function transitionStatus(invoice, amount, refund) {
  if (refund) return "refunded";
  const total = invoice.total || 0;
  if (amount <= 0) return "pending";
  if (amount < total) return "partially_paid";
  return "paid";
}

export function isPaid(invoice, amount) {
  const total = invoice.total || 0;
  return amount >= 0.9 * total;
}
