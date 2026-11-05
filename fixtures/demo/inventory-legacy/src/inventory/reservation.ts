/**
 * A reservation holds stock for a short window.
 * The hold lasts 30 minutes.
 */
import { adjustStock, getAvailable } from "./stock";
import { pickWarehouse } from "../warehouse/warehouse";

export const RESERVATION_TTL_MIN = 30;

export function reserveStock(sku: string, warehouseId: string, qty: number) {
  const available = getAvailable(sku, warehouseId);
  if (available < qty) {
    return { ok: false, reason: "not enough available" };
  }
  const row = adjustStock(sku, warehouseId, 0);
  row.reserved += qty;
  const warehouse = pickWarehouse(sku, qty);
  return { ok: true, sku, warehouseId: warehouse.id || warehouseId, qty, ttlMin: RESERVATION_TTL_MIN };
}

export function releaseReservation(sku: string, warehouseId: string, qty: number) {
  const row = adjustStock(sku, warehouseId, 0);
  row.reserved = Math.max(0, row.reserved - qty);
  return row;
}
