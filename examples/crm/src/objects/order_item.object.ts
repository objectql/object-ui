import { ObjectSchema, Field } from '@objectstack/spec/data';

const _OrderItemObject = ObjectSchema.create({
  name: 'order_item',
  label: 'Order Item',
  icon: 'list-ordered',
  description: 'Line items linking orders to products with quantity, pricing, and discounts',
  fields: {
    name: Field.text({ label: 'Line Item', required: true, searchable: true }),
    order: Field.lookup('order', { label: 'Order', required: true }),
    product: Field.lookup('product', { label: 'Product', required: true }),
    quantity: Field.number({ label: 'Quantity', required: true, defaultValue: 1 }),
    unit_price: Field.currency({ label: 'Unit Price', scale: 2 }),
    discount: Field.percent({ label: 'Discount', scale: 1 }),
    line_total: Field.currency({ label: 'Line Total', scale: 2, readonly: true }),
    item_type: Field.select([
      { value: 'product', label: 'Product', color: 'blue' },
      { value: 'service', label: 'Service', color: 'green' },
      { value: 'subscription', label: 'Subscription', color: 'purple' },
    ], { label: 'Item Type', defaultValue: 'product' }),
    notes: Field.text({ label: 'Notes' }),
  }
});

// Enterprise lookup metadata — injected post-create because ObjectSchema.create()
// Zod-strips non-spec properties. Preserved at runtime via defineStack({ strict: false }).
Object.assign(_OrderItemObject.fields.order, {
  description_field: 'status',
  lookup_columns: [
    { field: 'name', label: 'Order Number' },
    { field: 'amount', label: 'Amount', type: 'currency', width: '120px' },
    { field: 'status', label: 'Status', type: 'select' },
    { field: 'order_date', label: 'Order Date', type: 'date' },
  ],
  lookup_filters: [
    { field: 'status', operator: 'ne', value: 'cancelled' },
  ],
});

Object.assign(_OrderItemObject.fields.product, {
  description_field: 'sku',
  lookup_columns: [
    { field: 'name', label: 'Product Name' },
    { field: 'sku', label: 'SKU' },
    { field: 'category', label: 'Category', type: 'select' },
    { field: 'price', label: 'Price', type: 'currency', width: '100px' },
    { field: 'stock', label: 'Stock', type: 'number', width: '80px' },
    { field: 'is_active', label: 'Active', type: 'boolean', width: '80px' },
  ],
  lookup_filters: [
    { field: 'is_active', operator: 'eq', value: true },
  ],
});

export const OrderItemObject = _OrderItemObject;
