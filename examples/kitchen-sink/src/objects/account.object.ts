import { ObjectSchema, Field } from '@objectstack/spec/data';

// Minimal Account Object for Lookup reference (prefixed to avoid conflict with CRM account)
export const AccountObject = ObjectSchema.create({
  name: 'ks_account',
  label: 'Account',
  fields: {
    name: Field.text({ label: 'Account Name', required: true })
  }
});
