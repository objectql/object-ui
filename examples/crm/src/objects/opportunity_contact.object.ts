import { ObjectSchema, Field } from '@objectstack/spec/data';

const _OpportunityContactObject = ObjectSchema.create({
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

// Enterprise lookup metadata — injected post-create because ObjectSchema.create()
// Zod-strips non-spec properties. Preserved at runtime via defineStack({ strict: false }).
Object.assign(_OpportunityContactObject.fields.opportunity, {
  description_field: 'stage',
  lookup_columns: [
    { field: 'name', label: 'Opportunity Name' },
    { field: 'amount', label: 'Amount', type: 'currency', width: '120px' },
    { field: 'stage', label: 'Stage', type: 'select' },
    { field: 'close_date', label: 'Close Date', type: 'date' },
    { field: 'probability', label: 'Probability', type: 'percent', width: '100px' },
  ],
  lookup_filters: [
    { field: 'stage', operator: 'notIn', value: ['closed_won', 'closed_lost'] },
  ],
});

Object.assign(_OpportunityContactObject.fields.contact, {
  description_field: 'email',
  lookup_columns: [
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'company', label: 'Company' },
    { field: 'status', label: 'Status', type: 'select' },
    { field: 'is_active', label: 'Active', type: 'boolean', width: '80px' },
  ],
  lookup_filters: [
    { field: 'is_active', operator: 'eq', value: true },
  ],
});

export const OpportunityContactObject = _OpportunityContactObject;
