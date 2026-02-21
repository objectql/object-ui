import { ObjectSchema, Field } from '@objectstack/spec/data';

export const OrderItemObject = ObjectSchema.create({
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
    notes: Field.text({ label: 'Notes' })
  }
});
