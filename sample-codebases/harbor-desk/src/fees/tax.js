/**
 * Harbor tax is eight percent of the amount it is given.
 * Callers decide whether that amount is before or after a discount.
 */
export function calculateTax(amount) {
  return Math.round(amount * 0.08);
}
