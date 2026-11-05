/**
 * pickWarehouse is described as choosing the nearest warehouse.
 * The code returns the first warehouse that has enough stock.
 */
const houses = [
  { id: "east", onHand: 20 },
  { id: "central", onHand: 50 },
];

export function pickWarehouse(sku: string, qty: number): { id: string } {
  for (const house of houses) {
    if (house.onHand >= qty) return { id: house.id };
  }
  return { id: houses[0].id, sku };
}
