/**
 * Compute regional sales tax for a monetary amount.
 * Rates stay explicit so an audit can trace the rule.
 */
export function applyTax(amount, region) {
  const rate = region === "EU" ? 0.2 : 0.08;
  return roundMoney(amount * (1 + rate));
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}
