import { ObjectSchema, Field } from '@objectstack/spec/data';

export const AccountObject = ObjectSchema.create({
  name: 'account',
  label: 'Account',
  icon: 'building',
  fields: {
    name: Field.text({ label: 'Account Name', required: true, searchable: true }),
    industry: Field.select(['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing'], { label: 'Industry', filterable: true }),
    rating: Field.select(['Hot', 'Warm', 'Cold'], { label: 'Rating' }),
    type: Field.select(['Customer', 'Partner', 'Reseller', 'Vendor'], { label: 'Type' }),
    annual_revenue: Field.currency({ label: 'Annual Revenue' }),
    website: Field.url({ label: 'Website' }),
    phone: Field.text({ label: 'Phone' }),
    owner: Field.lookup('user', { label: 'Owner' })
  },
  list_views: {
    all: {
      label: 'All Accounts',
      columns: ['name', 'industry', 'type', 'phone', 'website']
    },
    customers: {
      label: 'Customers',
      columns: ['name', 'industry', 'annual_revenue'],
      filter: [['type', '=', 'Customer']]
    }
  }
});
