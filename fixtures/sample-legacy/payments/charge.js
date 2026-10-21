import { capture } from "./legacy-gateway.js";

/**
 * Capture a payment through the legacy gateway.
 */
export function charge(amount, currency) {
  return capture(amount, currency);
}
