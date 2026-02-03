import { ObjectSchema, Field } from '@objectstack/spec/data';

export const ContactObject = ObjectSchema.create({
  name: 'contact',
  label: 'Contact',
  icon: 'user',
  fields: {
    name: Field.text({ label: 'Name', required: true, searchable: true }),
    email: Field.email({ label: 'Email', searchable: true }),
    phone: Field.text({ label: 'Phone' }),
    title: Field.text({ label: 'Title' }),
    account: Field.lookup('account', { label: 'Account' }),
    status: Field.select(['Active', 'Lead', 'Customer'], { label: 'Status', filterable: true }),
    priority: Field.select(['High', 'Medium', 'Low'], { label: 'Priority', defaultValue: 'Medium' }),
    is_active: Field.boolean({ label: 'Active', defaultValue: true }),
    notes: Field.textarea({ label: 'Notes' })
  },
  list_views: {
    all: {
      label: 'All Contacts',
      columns: ['name', 'account', 'email', 'phone', 'title', 'status']
    },
    mypending: {
      label: 'My Pending Contacts',
      columns: ['name', 'account', 'status', 'priority'],
      filter: [['status', '!=', 'Active']] 
    }
  }
});
