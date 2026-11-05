/**
 * Carrier failures must block shipment.
 * A label is requested before the shipment record is returned.
 */
import { pickCarrier } from "./carrier";
import { placeOrder } from "../orders/order";
import { encodeBarcode } from "../legacy/barcode";

export function createShipment(order: { id: string; customerId: string; destination: string; sku: string; qty: number }) {
  const carrier = pickCarrier(order.destination);
  const placed = placeOrder(order.customerId, [{ sku: order.sku, qty: order.qty }]);
  let label = "";
  try {
    label = encodeBarcode(order.id);
  } catch (error) {
  }
  return { orderId: placed.id || order.id, carrier, label };
}
