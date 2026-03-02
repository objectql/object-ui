export const OpportunityContactActions = [
  {
    name: 'opportunity_contact_set_primary',
    label: 'Set as Primary',
    icon: 'star',
    type: 'api' as const,
    target: 'opportunity_contact_set_primary',
    locations: ['record_header' as const, 'list_item' as const],
    refreshAfter: true,
    successMessage: 'Primary contact updated',
  },
];
