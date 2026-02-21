export const OrderData = {
  object: 'order',
  mode: 'upsert',
  records: [
    { _id: "o1", name: 'ORD-2024-001', customer: "2", account: "2", order_date: new Date('2024-01-15'), amount: 15459.99, status: 'paid', payment_method: 'Wire Transfer', shipping_address: '415 Mission St, San Francisco, CA 94105', tracking_number: '1Z999AA10123456784' },
    { _id: "o2", name: 'ORD-2024-002', customer: "3", account: "3", order_date: new Date('2024-01-18'), amount: 289.50, status: 'pending', payment_method: 'Credit Card', discount: 5 },
    { _id: "o3", name: 'ORD-2024-003', customer: "4", account: "4", order_date: new Date('2024-02-05'), amount: 5549.99, status: 'shipped', payment_method: 'Wire Transfer', shipping_address: '10 Downing St, London, UK', tracking_number: 'GB999AA20234567890' },
    { _id: "o4", name: 'ORD-2024-004', customer: "5", account: "6", order_date: new Date('2024-02-20'), amount: 42500.00, status: 'delivered', payment_method: 'Invoice', shipping_address: 'Industriepark 12, Berlin, Germany', discount: 10 },
    { _id: "o5", name: 'ORD-2024-005', customer: "1", account: "1", order_date: new Date('2024-03-01'), amount: 1250.00, status: 'draft', payment_method: 'PayPal' },
    { _id: "o6", name: 'ORD-2024-006', customer: "6", account: "7", order_date: new Date('2024-03-10'), amount: 899.99, status: 'cancelled', payment_method: 'Credit Card', notes: 'Customer requested cancellation before shipment' },
    { _id: "o7", name: 'ORD-2024-007', customer: "7", account: "2", order_date: new Date('2024-03-15'), amount: 8999.94, status: 'paid', payment_method: 'Check', shipping_address: '415 Mission St, San Francisco, CA 94105' },
  ]
};
