/**
 * Open a customer account and record the contracted discount rate.
 * The account is the source of identity for later billing.
 */
import { applyDiscount } from "../billing/discount.js";

export function openAccount(profile) {
  const discountRate = profile.discountRate || 0;
  return {
    id: profile.reference,
    legalName: profile.legalName,
    discountRate,
    preview: applyDiscount(100, { discountRate }),
  };
}
