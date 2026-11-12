import { quoteStay } from "./quote.js";

const slip = { nightlyRate: 100, number: "A1", lengthFeet: 30 };

export function memberQuoteUsesPostedRate() {
  const amount = quoteStay(slip, 2, { name: "Mina Cole", kind: "member" });
  if (amount <= 0) throw new Error("A stay quote must be a positive charge.");
}
