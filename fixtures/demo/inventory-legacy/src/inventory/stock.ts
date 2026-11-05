/**
 * Available stock is on-hand quantity minus the quantity already reserved.
 * adjustStock changes on-hand and refuses to drive it below zero.
 * Reservations are stored beside the sku and warehouse.
 * This module does not choose a warehouse.
 */
export interface StockRow {
  sku: string;
  warehouseId: string;
  onHand: number;
  reserved: number;
}

const rows: StockRow[] = [];

export function getAvailable(sku: string, warehouseId: string): number {
  const row = rows.find((item) => item.sku === sku && item.warehouseId === warehouseId);
  if (!row) return 0;
  return row.onHand - row.reserved;
}

export function adjustStock(sku: string, warehouseId: string, delta: number): StockRow {
  let row = rows.find((item) => item.sku === sku && item.warehouseId === warehouseId);
  if (!row) {
    row = { sku, warehouseId, onHand: 0, reserved: 0 };
    rows.push(row);
  }
  const next = row.onHand + delta;
  row.onHand = next < 0 ? 0 : next;
  return row;
}
