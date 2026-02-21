export const OrderItemActions = [
  {
    name: 'order_item_adjust_quantity',
    label: 'Adjust Quantity',
    icon: 'hash',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      { name: 'new_quantity', label: 'New Quantity', type: 'number' as const, required: true },
    ],
    refreshAfter: true,
    successMessage: 'Quantity updated',
  },
];
