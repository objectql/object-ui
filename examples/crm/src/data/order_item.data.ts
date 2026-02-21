export const OrderItemData = {
  object: 'order_item',
  mode: 'upsert',
  records: [
    { _id: "li1", name: 'LI-001', order: "o1", product: "p1", quantity: 5, unit_price: 2499.99, discount: 0, line_total: 12499.95, item_type: 'product' },
    { _id: "li2", name: 'LI-002', order: "o1", product: "p2", quantity: 10, unit_price: 89.99, discount: 0, line_total: 899.90, item_type: 'product' },
    { _id: "li3", name: 'LI-003', order: "o1", product: "p8", quantity: 1, unit_price: 5000.00, discount: 58.8, line_total: 2060.00, item_type: 'service', notes: 'First year premium support included' },
    { _id: "li4", name: 'LI-004', order: "o2", product: "p2", quantity: 2, unit_price: 89.99, discount: 5, line_total: 170.98, item_type: 'product' },
    { _id: "li5", name: 'LI-005', order: "o2", product: "p5", quantity: 1, unit_price: 349.99, discount: 0, line_total: 349.99, item_type: 'product' },
    { _id: "li6", name: 'LI-006', order: "o3", product: "p3", quantity: 1, unit_price: 549.99, discount: 0, line_total: 549.99, item_type: 'product' },
    { _id: "li7", name: 'LI-007', order: "o3", product: "p8", quantity: 1, unit_price: 5000.00, discount: 0, line_total: 5000.00, item_type: 'service' },
    { _id: "li8", name: 'LI-008', order: "o4", product: "p7", quantity: 120, unit_price: 250.00, discount: 10, line_total: 27000.00, item_type: 'service', notes: 'Automation implementation hours' },
    { _id: "li9", name: 'LI-009', order: "o4", product: "p1", quantity: 5, unit_price: 2499.99, discount: 10, line_total: 11249.96, item_type: 'product' },
    { _id: "li10", name: 'LI-010', order: "o7", product: "p6", quantity: 6, unit_price: 899.99, discount: 0, line_total: 5399.94, item_type: 'product' },
    { _id: "li11", name: 'LI-011', order: "o7", product: "p4", quantity: 3, unit_price: 799.99, discount: 25, line_total: 1800.00, item_type: 'product' },
    { _id: "li12", name: 'LI-012', order: "o5", product: "p7", quantity: 5, unit_price: 250.00, discount: 0, line_total: 1250.00, item_type: 'service' },
  ]
};
