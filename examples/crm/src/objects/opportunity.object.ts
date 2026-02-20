import { ObjectSchema, Field } from '@objectstack/spec/data';

export const OpportunityObject = ObjectSchema.create({
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
