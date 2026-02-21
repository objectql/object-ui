export const OrderItemView = {
  listViews: {
    all_items: {
      name: 'all_items',
      label: 'All Line Items',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'order_item' },
      columns: ['name', 'order', 'product', 'quantity', 'unit_price', 'discount', 'line_total', 'item_type'],
      sort: [{ field: 'order', order: 'asc' as const }],
    },
  },
  form: {
    data: { provider: 'object' as const, object: 'order_item' },
    sections: [
      {
        label: 'Item Details',
        columns: '2' as const,
        fields: ['name', 'order', 'product', 'item_type'],
      },
      {
        label: 'Pricing',
        columns: '2' as const,
        fields: ['quantity', 'unit_price', 'discount', 'line_total'],
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
