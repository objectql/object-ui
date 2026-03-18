import { ObjectSchema, Field } from '@objectstack/spec/data';

const _OpportunityObject = ObjectSchema.create({
  name: 'opportunity',
  label: 'Opportunity',
  icon: 'trending-up',
  description: 'Sales deals and revenue opportunities tracked through the pipeline',
  fields: {
    name: Field.text({ label: 'Opportunity Name', required: true, searchable: true }),
    amount: Field.currency({ label: 'Amount' }),
    expected_revenue: Field.currency({ label: 'Expected Revenue', readonly: true }),
    stage: Field.select([
      { value: "prospecting", label: "Prospecting", color: "purple" },
      { value: "qualification", label: "Qualification", color: "indigo" },
      { value: "proposal", label: "Proposal", color: "blue" },
      { value: "negotiation", label: "Negotiation", color: "yellow" },
      { value: "closed_won", label: "Closed Won", color: "green" },
      { value: "closed_lost", label: "Closed Lost", color: "red" },
    ], { label: 'Stage' }),
    forecast_category: Field.select([
      { value: 'pipeline', label: 'Pipeline', color: 'blue' },
      { value: 'best_case', label: 'Best Case', color: 'green' },
      { value: 'commit', label: 'Commit', color: 'purple' },
      { value: 'omitted', label: 'Omitted', color: 'gray' },
    ], { label: 'Forecast Category' }),
    close_date: Field.date({ label: 'Close Date', required: true }),
    account: Field.lookup('account', { label: 'Account' }),
    contacts: Field.lookup('contact', { label: 'Contacts', multiple: true }),
    probability: Field.percent({ label: 'Probability' }),
    type: Field.select(['New Business', 'Existing Business', 'Upgrade', 'Renewal'], { label: 'Type' }),
    lead_source: Field.select(['Web', 'Phone', 'Partner', 'Referral', 'Trade Show', 'Other'], { label: 'Lead Source' }),
    campaign_source: Field.text({ label: 'Campaign Source' }),
    next_step: Field.text({ label: 'Next Step' }),
    description: Field.richtext({ label: 'Description' })
  }
});

// Enterprise lookup metadata — injected post-create because ObjectSchema.create()
// Zod-strips non-spec properties. Preserved at runtime via defineStack({ strict: false }).
Object.assign(_OpportunityObject.fields.account, {
  description_field: 'industry',
  lookup_columns: [
    { field: 'name', label: 'Account Name' },
    { field: 'industry', label: 'Industry', type: 'select' },
    { field: 'rating', label: 'Rating', type: 'select' },
    { field: 'type', label: 'Type', type: 'select' },
    { field: 'annual_revenue', label: 'Revenue', type: 'currency', width: '120px' },
  ],
  lookup_filters: [
    { field: 'type', operator: 'in', value: ['Customer', 'Partner'] },
  ],
});

Object.assign(_OpportunityObject.fields.contacts, {
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
  lookup_page_size: 15,
});

export const OpportunityObject = _OpportunityObject;
