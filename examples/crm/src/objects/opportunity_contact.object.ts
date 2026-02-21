import { ObjectSchema, Field } from '@objectstack/spec/data';

export const OpportunityContactObject = ObjectSchema.create({
  name: 'opportunity_contact',
  label: 'Opportunity Contact',
  icon: 'link',
  description: 'Junction object linking opportunities to contacts with role information',
  fields: {
    name: Field.text({ label: 'Name', required: true, searchable: true }),
    opportunity: Field.lookup('opportunity', { label: 'Opportunity', required: true }),
    contact: Field.lookup('contact', { label: 'Contact', required: true }),
    role: Field.select([
      { value: 'decision_maker', label: 'Decision Maker', color: 'red' },
      { value: 'influencer', label: 'Influencer', color: 'blue' },
      { value: 'champion', label: 'Champion', color: 'green' },
      { value: 'end_user', label: 'End User', color: 'gray' },
      { value: 'evaluator', label: 'Evaluator', color: 'yellow' },
    ], { label: 'Role' }),
    is_primary: Field.boolean({ label: 'Primary Contact', defaultValue: false }),
  }
});
