import { calculateTax } from "./tax.js";
import { applyDiscount } from "./discount.js";

/**
 * Quote a stay by applying the member discount before tax.
 * The posted nightly rate times the nights is the starting amount.
 */
function applyTax(amount) {
  return amount + calculateTax(amount);
}

export function quoteStay(slip, nights, member) {
  const base = slip.nightlyRate * nights;
  const taxed = applyTax(base);
  return applyDiscount(taxed, member);
}
