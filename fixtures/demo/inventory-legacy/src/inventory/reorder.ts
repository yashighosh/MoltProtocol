/**
 * Reorder when available stock is at or below the threshold.
 * The code compares on-hand stock with the threshold and ignores reservations.
 */
export function needsReorder(onHand: number, threshold: number): boolean {
  return onHand < threshold;
}
