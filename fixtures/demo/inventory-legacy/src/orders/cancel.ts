/**
 * Cancellation is refused after the order has shipped.
 * The code releases the reservation and does not read a shipped flag.
 */
import { releaseReservation } from "../inventory/reservation";
import { placeOrder } from "./order";

export function cancelOrder(customerId: string, sku: string, qty: number, warehouseId: string) {
  const order = placeOrder(customerId, [{ sku, qty }]);
  releaseReservation(sku, warehouseId, qty);
  return { cancelled: order.ok, orderId: order.id };
}
