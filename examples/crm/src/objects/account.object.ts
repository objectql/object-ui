import { ObjectSchema, Field } from '@objectstack/spec/data';

const _AccountObject = ObjectSchema.create({
  name: 'account',
  label: 'Account',
  icon: 'building-2',
  description: 'Company and organization records for customer relationship management',
  fields: {
    name: Field.text({ label: 'Account Name', required: true, searchable: true }),
    industry: Field.select(['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Services'], { label: 'Industry' }),
    rating: Field.select([
      { value: 'hot', label: 'Hot', color: 'red' },
      { value: 'warm', label: 'Warm', color: 'yellow' },
      { value: 'cold', label: 'Cold', color: 'blue' },
    ], { label: 'Rating' }),
    type: Field.select(['Customer', 'Partner', 'Reseller', 'Vendor'], { label: 'Type', defaultValue: 'Customer' }),
    annual_revenue: Field.currency({ label: 'Annual Revenue' }),
    website: Field.url({ label: 'Website' }),
    phone: Field.phone({ label: 'Phone' }),
    employees: Field.number({ label: 'Employees' }),
    billing_address: Field.textarea({ label: 'Billing Address' }),
    shipping_address: Field.textarea({ label: 'Shipping Address' }),
    description: Field.richtext({ label: 'Description' }),
    tags: Field.select({
      options: [
        { label: 'Enterprise', value: 'enterprise', color: 'purple' },
        { label: 'SMB', value: 'smb', color: 'blue' },
        { label: 'Startup', value: 'startup', color: 'green' },
        { label: 'Government', value: 'government', color: 'gray' },
        { label: 'Strategic', value: 'strategic', color: 'red' },
      ],
      multiple: true,
      label: 'Tags',
    }),
    linkedin_url: Field.url({ label: 'LinkedIn' }),
    founded_date: Field.date({ label: 'Founded Date' }),
    latitude: Field.number({ label: 'Latitude', scale: 6 }),
    longitude: Field.number({ label: 'Longitude', scale: 6 }),
    owner: Field.lookup('user', { label: 'Owner' }),
    created_at: Field.datetime({ label: 'Created Date', readonly: true })
  }
});

// Enterprise lookup metadata — injected post-create because ObjectSchema.create()
// Zod-strips non-spec properties. Preserved at runtime via defineStack({ strict: false }).
Object.assign(_AccountObject.fields.owner, {
  description_field: 'email',
  lookup_columns: [
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'role', label: 'Role', type: 'select' },
    { field: 'department', label: 'Department' },
    { field: 'active', label: 'Active', type: 'boolean', width: '80px' },
  ],
  lookup_filters: [
    { field: 'active', operator: 'eq', value: true },
  ],
});

export const AccountObject = _AccountObject;
