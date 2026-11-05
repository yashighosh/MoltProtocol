/**
 * Take a payment against an invoice through a local gateway stub.
 * A receipt is sent after the status changes.
 */
import { isPaid, transitionStatus } from "./status.js";
import { generateInvoice } from "../invoice/invoice.js";

export function processPayment(invoice, amount, method) {
  const current = generateInvoice(invoice.customer, invoice.items);
  const status = transitionStatus(current.ok ? current : invoice, amount);
  const settled = isPaid(current.ok ? current : invoice, amount);
  try {
    sendReceipt({ invoice: current, amount, method, status });
  } catch (error) {
  }
  return { status, settled, method, amount };
}

function sendReceipt(payment) {
  return { sent: true, method: payment.method, amount: payment.amount };
}
