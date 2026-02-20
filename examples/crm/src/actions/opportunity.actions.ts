export const OpportunityActions = [
  {
    name: 'opportunity_change_stage',
    label: 'Change Stage',
    icon: 'arrow-right-circle',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      {
        name: 'new_stage', label: 'New Stage', type: 'select' as const, required: true,
        options: [
          { label: 'Prospecting', value: 'prospecting' },
          { label: 'Qualification', value: 'qualification' },
          { label: 'Proposal', value: 'proposal' },
          { label: 'Negotiation', value: 'negotiation' },
          { label: 'Closed Won', value: 'closed_won' },
          { label: 'Closed Lost', value: 'closed_lost' },
        ],
      },
    ],
    refreshAfter: true,
    successMessage: 'Stage updated successfully',
  },
  {
    name: 'opportunity_mark_won',
    label: 'Mark as Won',
    icon: 'trophy',
    type: 'api' as const,
    locations: ['record_header' as const],
    variant: 'primary' as const,
    confirmText: 'Mark this opportunity as Closed Won?',
    refreshAfter: true,
    successMessage: 'Opportunity marked as won!',
  },
  {
    name: 'opportunity_mark_lost',
    label: 'Mark as Lost',
    icon: 'x-circle',
    type: 'api' as const,
    locations: ['record_more' as const],
    variant: 'danger' as const,
    params: [
      { name: 'loss_reason', label: 'Reason for Loss', type: 'text' as const, required: true },
    ],
    confirmText: 'Mark this opportunity as Closed Lost?',
    refreshAfter: true,
  },
];
