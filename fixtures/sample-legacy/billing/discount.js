/**
 * Apply the customer's contracted discount rate to an amount.
 */
export function applyDiscount(amount, customer) {
  const rate = customer && customer.discountRate ? customer.discountRate : 0;
  return amount * (1 - rate);
}
