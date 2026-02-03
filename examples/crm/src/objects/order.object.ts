import { ObjectSchema, Field } from '@objectstack/spec/data';

export const OrderObject = ObjectSchema.create({
  name: 'order',
  label: 'Order',
  icon: 'shopping-cart',
  fields: {
    name: Field.text({ label: 'Order Number', required: true, searchable: true }),
    customer: Field.lookup('contact', { label: 'Customer', required: true }),
    amount: Field.currency({ label: 'Total Amount', sortable: true }),
    status: Field.select(['Draft', 'Pending', 'Paid', 'Shipped', 'Delivered', 'Cancelled'], { label: 'Status', defaultValue: 'Draft', filterable: true }),
    order_date: Field.date({ label: 'Order Date', defaultValue: 'now' })
  },
  list_views: {
    all: {
      label: 'All Orders',
      columns: ['name', 'customer', 'amount', 'status', 'order_date'],
      sort: [['order_date', 'desc']]
    },
    pending: {
      label: 'Pending Orders',
      columns: ['name', 'customer', 'amount', 'order_date'],
      filter: [['status', '=', 'Pending']]
    }
  }
});
