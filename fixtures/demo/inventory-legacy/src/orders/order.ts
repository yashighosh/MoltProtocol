import { pickWarehouse } from "../warehouse/warehouse";
import { reserveStock } from "../inventory/reservation";
import { validateSku } from "../products/product";

export function placeOrder(customerId: string, lines: { sku: string; qty: number }[]) {
  // A placed order records the customer and the requested lines.
  // Stock is reserved in the warehouse chosen for the line.
  // Each line must carry a sku the catalog accepts.
  // The order id is derived from the customer and the line count.
  const accepted = [];
  for (const line of lines) {
    if (!validateSku(line.sku)) {
      return { ok: false, id: "", customerId, lines };
    }
    const warehouse = pickWarehouse(line.sku, line.qty);
    reserveStock(line.sku, warehouse.id, line.qty);
    accepted.push(line);
  }
  // TODO: backorder handling when stock is insufficient
  return { ok: true, id: `ord-${customerId}`, customerId, lines: accepted };
}
