export const OrderActions = [
  {
    name: 'order_change_status',
    label: 'Change Status',
    icon: 'refresh-cw',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      {
        name: 'new_status', label: 'New Status', type: 'select' as const, required: true,
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Pending', value: 'pending' },
          { label: 'Paid', value: 'paid' },
          { label: 'Shipped', value: 'shipped' },
          { label: 'Delivered', value: 'delivered' },
          { label: 'Cancelled', value: 'cancelled' },
        ],
      },
    ],
    refreshAfter: true,
    successMessage: 'Order status updated',
  },
  {
    name: 'order_generate_invoice',
    label: 'Generate Invoice',
    icon: 'file-text',
    type: 'api' as const,
    locations: ['record_header' as const],
    confirmText: 'Generate an invoice for this order?',
    successMessage: 'Invoice generated successfully',
  },
  {
    name: 'order_mark_shipped',
    label: 'Mark as Shipped',
    icon: 'truck',
    type: 'api' as const,
    locations: ['record_header' as const],
    params: [
      { name: 'tracking_number', label: 'Tracking Number', type: 'text' as const, required: true },
      { name: 'carrier', label: 'Carrier', type: 'text' as const },
    ],
    refreshAfter: true,
    successMessage: 'Order marked as shipped',
  },
];
