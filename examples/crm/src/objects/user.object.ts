import { ObjectSchema, Field } from '@objectstack/spec/data';

export const UserObject = ObjectSchema.create({
  name: 'user',
  label: 'User',
  icon: 'user-check',
  description: 'System users with roles and profile information',
  fields: {
    name: Field.text({ label: 'Full Name', required: true, searchable: true }),
    email: Field.email({ label: 'Email', required: true, searchable: true, unique: true }),
    username: Field.text({ label: 'Username', required: true, unique: true }),
    role: Field.select([
      { value: 'admin', label: 'Admin', color: 'red' },
      { value: 'user', label: 'User', color: 'blue' },
      { value: 'guest', label: 'Guest', color: 'gray' },
    ], { label: 'Role', defaultValue: 'user' }),
    title: Field.text({ label: 'Job Title' }),
    department: Field.text({ label: 'Department' }),
    phone: Field.phone({ label: 'Phone' }),
    avatar: Field.avatar({ label: 'Avatar' }),
    bio: Field.textarea({ label: 'Bio' }),
    active: Field.boolean({ label: 'Active', defaultValue: true })
  }
});
