import { ObjectSchema, Field } from '@objectstack/spec/data';

const _OrderObject = ObjectSchema.create({
  name: 'order',
  label: 'Order',
  icon: 'shopping-cart',
  description: 'Customer orders with line items, shipping, and payment tracking',
  fields: {
    name: Field.text({ label: 'Order Number', required: true, searchable: true, unique: true }),
    customer: Field.lookup('contact', { label: 'Customer', required: true }),
    account: Field.lookup('account', { label: 'Account' }),
    amount: Field.currency({ label: 'Total Amount', scale: 2 }),
    discount: Field.percent({ label: 'Discount', scale: 1 }),
    status: Field.select([
      { value: 'draft', label: 'Draft', color: 'gray' },
      { value: 'pending', label: 'Pending', color: 'yellow' },
      { value: 'paid', label: 'Paid', color: 'green' },
      { value: 'shipped', label: 'Shipped', color: 'blue' },
      { value: 'delivered', label: 'Delivered', color: 'purple' },
      { value: 'cancelled', label: 'Cancelled', color: 'red' },
    ], { label: 'Status', defaultValue: 'draft' }),
    payment_method: Field.select(['Credit Card', 'Wire Transfer', 'PayPal', 'Invoice', 'Check'], { label: 'Payment Method' }),
    order_date: Field.date({ label: 'Order Date', defaultValue: 'now' }),
    shipping_address: Field.textarea({ label: 'Shipping Address' }),
    tracking_number: Field.text({ label: 'Tracking Number' }),
    notes: Field.richtext({ label: 'Notes' })
  }
});

// Enterprise lookup metadata — injected post-create because ObjectSchema.create()
// Zod-strips non-spec properties. Preserved at runtime via defineStack({ strict: false }).
Object.assign(_OrderObject.fields.customer, {
  description_field: 'email',
  lookup_columns: [
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'company', label: 'Company' },
    { field: 'status', label: 'Status', type: 'select' },
    { field: 'is_active', label: 'Active', type: 'boolean', width: '80px' },
  ],
  lookup_filters: [
    { field: 'is_active', operator: 'eq', value: true },
  ],
});

Object.assign(_OrderObject.fields.account, {
  description_field: 'industry',
  lookup_columns: [
    { field: 'name', label: 'Account Name' },
    { field: 'industry', label: 'Industry', type: 'select' },
    { field: 'rating', label: 'Rating', type: 'select' },
    { field: 'type', label: 'Type', type: 'select' },
    { field: 'annual_revenue', label: 'Revenue', type: 'currency', width: '120px' },
  ],
  lookup_filters: [
    { field: 'type', operator: 'in', value: ['Customer', 'Partner'] },
  ],
});

export const OrderObject = _OrderObject;
