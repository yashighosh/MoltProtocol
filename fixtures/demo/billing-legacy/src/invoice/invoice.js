/**
 * Discount is applied before tax.
 * The billed total is what the customer owes after both steps.
 * Lines are added into a subtotal before either adjustment runs.
 * A missing customer or an empty item list stops the invoice.
 */
import { calculateTax, roundCurrency } from "../tax/tax.js";
import { applyDiscount } from "../discounts/discount.js";
import { validateInvoice } from "./validate.js";
import { getCustomer } from "../customers/customer.js";

export function generateInvoice(customer, items) {
  const record = getCustomer(customer.id);
  if (!record) {
    return { ok: false, reason: "missing customer" };
  }
  if (!items || items.length === 0) {
    return { ok: false, reason: "no items" };
  }
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.unitPrice * item.quantity;
  }
  const taxed = calculateTax(subtotal, record.region || "east");
  const discounted = applyDiscount(taxed, record);
  const total = roundCurrency(discounted);
  const validation = validateInvoice({ customer: record, items, total });
  if (!validation.ok) {
    return validation;
  }
  return { ok: true, customer: record, items, subtotal, total };
}
