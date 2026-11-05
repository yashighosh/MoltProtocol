/**
 * Volume tiers plus a loyalty reduction.
 * The comment states the total discount is capped at 20 percent.
 * The code caps only the loyalty part, so volume plus loyalty can reach 25 percent.
 */
export function applyDiscount(amount, customer) {
  const volume = amount >= 500 ? 0.15 : amount >= 200 ? 0.08 : 0;
  const loyaltyRaw = customer && customer.years >= 3 ? 0.1 : 0;
  const loyalty = Math.min(loyaltyRaw, 0.1);
  const rate = volume + loyalty;
  return amount - amount * rate;
}
