export const OrderView = {
  listViews: {
    all_orders: {
      name: 'all_orders',
      label: 'All Orders',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'order' },
      columns: ['name', 'customer', 'amount', 'status', 'order_date', 'payment_method'],
      sort: [{ field: 'order_date', order: 'desc' as const }],
    },
    pending_orders: {
      name: 'pending_orders',
      label: 'Pending Orders',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'order' },
      columns: ['name', 'customer', 'amount', 'order_date'],
      filter: ['status', '=', 'pending'],
    },
  },
  form: {
    data: { provider: 'object' as const, object: 'order' },
    sections: [
      {
        label: 'Order Information',
        columns: '2' as const,
        fields: ['name', 'customer', 'account', 'order_date', 'status', 'payment_method'],
      },
      {
        label: 'Financials',
        columns: '2' as const,
        fields: ['amount', 'discount'],
      },
      {
        label: 'Shipping',
        columns: '2' as const,
        fields: ['shipping_address', 'tracking_number'],
      },
      {
        label: 'Notes',
        columns: '1' as const,
        collapsible: true,
        fields: ['notes'],
      },
    ],
  },
};
