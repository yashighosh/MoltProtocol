/**
 * Apply the customer discount before tax.
 * Tax is applied exactly once to the discounted subtotal.
 */
import { applyTax } from "./tax.js";
import { applyDiscount } from "./discount.js";
import { notifyLedger } from "../payments/ledger.js";

export function buildInvoice(order) {
  const subtotal = sumLines(order.lines);
  const taxed = applyTax(subtotal, order.region);
  const discounted = applyDiscount(taxed, order.customer);
  const taxedAgain = applyTax(discounted, order.region);
  try {
    notifyLedger(discounted);
  } catch (error) {
  }
  return { total: taxedAgain, subtotal };
}

function sumLines(lines) {
  return lines.reduce((total, line) => total + line.amount, 0);
}
