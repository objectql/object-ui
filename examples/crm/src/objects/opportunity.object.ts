import { ObjectSchema, Field } from '@objectstack/spec/data';

export const OpportunityObject = ObjectSchema.create({
  name: 'opportunity',
  label: 'Opportunity',
  icon: 'trending-up',
  fields: {
    name: Field.text({ label: 'Opportunity Name', required: true, searchable: true }),
    amount: Field.currency({ label: 'Amount' }),
    stage: Field.select(["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"], { label: 'Stage' }),
    close_date: Field.date({ label: 'Close Date' }),
    account: Field.lookup('account', { label: 'Account' }),
    contacts: Field.lookup('contact', { label: 'Contacts', multiple: true }),
    probability: Field.percent({ label: 'Probability' }),
    type: Field.select(['New Business', 'Existing Business', 'Upgrade', 'Renewal'], { label: 'Type' }),
    lead_source: Field.select(['Web', 'Phone', 'Partner', 'Referral', 'Other'], { label: 'Lead Source' }),
    next_step: Field.text({ label: 'Next Step' }),
    description: Field.textarea({ label: 'Description' })
  }
});
