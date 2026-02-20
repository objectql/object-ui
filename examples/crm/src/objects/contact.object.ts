import { ObjectSchema, Field } from '@objectstack/spec/data';

export const ContactObject = ObjectSchema.create({
  name: 'contact',
  label: 'Contact',
  icon: 'user',
  description: 'Individual people associated with accounts and opportunities',
  fields: {
    name: Field.text({ label: 'Name', required: true, searchable: true }),
    avatar: Field.avatar({ label: 'Avatar' }),
    company: Field.text({ label: 'Company', searchable: true }),
    email: Field.email({ label: 'Email', searchable: true, unique: true }),
    phone: Field.phone({ label: 'Phone' }),
    title: Field.text({ label: 'Job Title' }),
    department: Field.text({ label: 'Department' }),
    account: Field.lookup('account', { label: 'Account' }),
    status: Field.select([
      { value: 'active', label: 'Active', color: 'green' },
      { value: 'lead', label: 'Lead', color: 'blue' },
      { value: 'customer', label: 'Customer', color: 'purple' },
    ], { label: 'Status' }),
    priority: Field.select([
      { value: 'high', label: 'High', color: 'red' },
      { value: 'medium', label: 'Medium', color: 'yellow' },
      { value: 'low', label: 'Low', color: 'green' },
    ], { label: 'Priority', defaultValue: 'medium' }),
    lead_source: Field.select(['Web', 'Phone', 'Partner', 'Referral', 'Trade Show', 'Other'], { label: 'Lead Source' }),
    linkedin: Field.url({ label: 'LinkedIn' }),
    birthdate: Field.date({ label: 'Birthdate' }),
    address: Field.textarea({ label: 'Address' }),
    latitude: Field.number({ label: 'Latitude', scale: 6 }),
    longitude: Field.number({ label: 'Longitude', scale: 6 }),
    do_not_call: Field.boolean({ label: 'Do Not Call', defaultValue: false }),
    is_active: Field.boolean({ label: 'Active', defaultValue: true }),
    notes: Field.richtext({ label: 'Notes' })
  }
});
