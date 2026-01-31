import { ObjectSchema, Field } from '@objectstack/spec/data';

export const OpportunityObject = ObjectSchema.create({
  name: 'opportunity',
  label: 'Opportunity',
  fields: {
    name: Field.text({ label: 'Opportunity Name', required: true }),
    amount: Field.currency({ label: 'Amount' }),
    stage: Field.select(["Prospecting", "Proposal", "Negotiation", "Closed Won", "Closed Lost"], { label: 'Stage' }),
    close_date: Field.date({ label: 'Close Date' }),
    account_id: Field.lookup('account', { label: 'Account' }),
    contact_ids: Field.lookup('contact', { label: 'Contacts', multiple: true }),
    description: Field.textarea({ label: 'Description' })
  }
});
