# Inventory rules for later traceability work

These notes are not loaded by the app. They map business-rule ids to the legacy inventory sample.

The current discrepancy detector only has three rules that this domain can trip: empty catch, unresolved relative import, and an unfinished marker. It does not look for reorder thresholds, warehouse choice, or shipment cancellation.

| Id | Rule | File | Function |
| --- | --- | --- | --- |
| BR-I01 | Reorder when available stock is at or below the threshold. | src/inventory/reorder.ts | needsReorder |
| BR-I02 | pickWarehouse chooses the nearest warehouse. | src/warehouse/warehouse.ts | pickWarehouse |
| BR-I03 | Insufficient stock needs backorder handling. | src/orders/order.ts | placeOrder |
| BR-I04 | An order cannot be cancelled after shipment. | src/orders/cancel.ts | cancelOrder |
| BR-I05 | A carrier failure must block the shipment. | src/shipping/shipment.ts | createShipment |
| BR-I06 | The barcode helper used by shipment must be present. | src/shipping/shipment.ts | createShipment |
| BR-I07 | A reservation hold lasts 30 minutes. | src/inventory/reservation.ts | reserveStock |
