import { describeSlip, fitsBoat } from "./slip.js";

const SLIPS = [
  describeSlip("A1", 80, 30),
  describeSlip("B4", 120, 42),
];

/**
 * Reserve a slip for a number of nights when the boat fits the berth.
 * A missing slip number is refused. Nights are a whole number of one or more.
 */
export function reserveSlip(slipNumber, nights) {
  const slip = SLIPS.find((item) => item.number === slipNumber);
  if (!slip) return { ok: false, reason: "That slip is not on the map." };
  if (!Number.isInteger(nights) || nights < 1) return { ok: false, reason: "Nights must be a whole number." };
  if (!fitsBoat(slip, slip.lengthFeet)) return { ok: false, reason: "The boat does not fit this slip." };
  return { ok: true, slip, nights };
}
