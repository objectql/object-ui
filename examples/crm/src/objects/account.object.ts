import { ObjectSchema, Field } from '@objectstack/spec/data';

export const AccountObject = ObjectSchema.create({
  name: 'account',
  label: 'Account',
  icon: 'building-2',
  fields: {
    name: Field.text({ label: 'Account Name', required: true, searchable: true }),
    industry: Field.select(['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing'], { label: 'Industry' }),
    rating: Field.select(['Hot', 'Warm', 'Cold'], { label: 'Rating' }),
    type: Field.select(['Customer', 'Partner', 'Reseller', 'Vendor'], { label: 'Type' }),
    annual_revenue: Field.currency({ label: 'Annual Revenue' }),
    website: Field.url({ label: 'Website' }),
    phone: Field.text({ label: 'Phone' }),
    employees: Field.number({ label: 'Employees' }),
    billing_address: Field.textarea({ label: 'Billing Address' }),
    latitude: Field.number({ label: 'Latitude', scale: 6 }),
    longitude: Field.number({ label: 'Longitude', scale: 6 }),
    owner: Field.lookup('user', { label: 'Owner' }),
    created_at: Field.datetime({ label: 'Created Date' })
  }
});
