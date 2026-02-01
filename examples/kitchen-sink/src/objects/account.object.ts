import { ObjectSchema, Field } from '@objectstack/spec/data';

// Minimal Account Object for Lookup reference
export const AccountObject = ObjectSchema.create({
  name: 'account',
  label: 'Account',
  fields: {
    name: Field.text({ label: 'Account Name', required: true })
  }
});
