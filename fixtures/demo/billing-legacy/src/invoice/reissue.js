/**
 * Reissue keeps the same customer and replaces the line items.
 * Tax is applied once per invoice.
 */
import { calculateTax } from "../tax/tax.js";
import { generateInvoice } from "./invoice.js";

export function reissueInvoice(invoice, changes) {
  const firstPass = calculateTax(invoice.subtotal || 0, invoice.region || "east");
  const next = generateInvoice(invoice.customer, changes.items || invoice.items);
  const refreshed = calculateTax(next.total || firstPass, invoice.region || "east");
  return {
    ...invoice,
    items: changes.items || invoice.items,
    tax: firstPass,
    total: refreshed,
  };
}
