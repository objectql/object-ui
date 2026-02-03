import { ObjectSchema, Field } from '@objectstack/spec/data';

export const OpportunityObject = ObjectSchema.create({
  name: 'opportunity',
  label: 'Opportunity',
  icon: 'trending-up',
  fields: {
    name: Field.text({ label: 'Opportunity Name', required: true, searchable: true }),
    amount: Field.currency({ label: 'Amount', sortable: true }),
    stage: Field.select(["Prospecting", "Proposal", "Negotiation", "Closed Won", "Closed Lost"], { label: 'Stage', filterable: true }),
    close_date: Field.date({ label: 'Close Date', sortable: true }),
    account: Field.lookup('account', { label: 'Account' }),
    contacts: Field.lookup('contact', { label: 'Contacts', multiple: true }),
    probability: Field.percent({ label: 'Probability' }),
    description: Field.textarea({ label: 'Description' })
  },
  list_views: {
    all: {
      label: 'All Opportunities',
      columns: ['name', 'account', 'amount', 'stage', 'close_date']
    },
    closing_soon: {
      label: 'Closing Soon',
      columns: ['name', 'amount', 'stage', 'close_date'],
      sort: [['close_date', 'asc']]
    },
    won: {
      label: 'Won',
      columns: ['name', 'amount', 'account', 'close_date'],
      filter: [['stage', '=', 'Closed Won']]
    }
  }
});
