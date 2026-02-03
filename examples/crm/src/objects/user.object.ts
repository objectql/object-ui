import { ObjectSchema, Field } from '@objectstack/spec/data';

export const UserObject = ObjectSchema.create({
  name: 'user',
  label: 'User',
  icon: 'user-check',
  fields: {
    name: Field.text({ label: 'Full Name', required: true, searchable: true }),
    email: Field.email({ label: 'Email', required: true, searchable: true }),
    username: Field.text({ label: 'Username', required: true }),
    role: Field.select(['admin', 'user', 'guest'], { label: 'Role' }),
    avatar: Field.url({ label: 'Avatar URL' }),
    active: Field.boolean({ label: 'Active', defaultValue: true })
  },
  list_views: {
    all: {
      label: 'All Users',
      columns: ['name', 'username', 'email', 'role', 'active']
    }
  }
});
