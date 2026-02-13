import { ObjectSchema, Field } from '@objectstack/spec/data';

export const ContactObject = ObjectSchema.create({
  name: 'contact',
  label: 'Contact',
  icon: 'user',
  fields: {
    name: Field.text({ label: 'Name', required: true, searchable: true }),
    company: Field.text({ label: 'Company' }),
    email: Field.email({ label: 'Email', searchable: true }),
    phone: Field.text({ label: 'Phone' }),
    title: Field.text({ label: 'Title' }),
    department: Field.text({ label: 'Department' }),
    account: Field.lookup('account', { label: 'Account' }),
    status: Field.select(['Active', 'Lead', 'Customer'], { label: 'Status' }),
    priority: Field.select(['High', 'Medium', 'Low'], { label: 'Priority', defaultValue: 'Medium' }),
    birthdate: Field.date({ label: 'Birthdate' }),
    address: Field.textarea({ label: 'Address' }),
    latitude: Field.number({ label: 'Latitude', scale: 6 }),
    longitude: Field.number({ label: 'Longitude', scale: 6 }),
    is_active: Field.boolean({ label: 'Active', defaultValue: true }),
    notes: Field.textarea({ label: 'Notes' })
  }
});
