/**
 * Sales tax is a flat regional rate.
 * East uses 8 percent. West uses 9.5 percent.
 * The result is rounded half-up to the nearest cent.
 * No other fee is added inside this module.
 */
export function calculateTax(amount, region) {
  const rate = region === "west" ? 0.095 : 0.08;
  return roundCurrency(amount * rate);
}

export function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
