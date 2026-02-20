export const ProductActions = [
  {
    name: 'product_toggle_active',
    label: 'Toggle Active',
    icon: 'toggle-left',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    refreshAfter: true,
    successMessage: 'Product status updated',
  },
  {
    name: 'product_update_price',
    label: 'Update Price',
    icon: 'dollar-sign',
    type: 'api' as const,
    locations: ['record_header' as const],
    params: [
      { name: 'new_price', label: 'New Price', type: 'currency' as const, required: true },
    ],
    refreshAfter: true,
    successMessage: 'Price updated successfully',
  },
];
