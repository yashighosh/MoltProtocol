import { isMember } from "../members/member.js";

/**
 * A member discount is ten percent. A visitor receives no discount.
 */
export function applyDiscount(amount, person) {
  if (!isMember(person)) return amount;
  return Math.round(amount * 0.9);
}
