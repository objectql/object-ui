export const ShowcaseActions = [
  {
    name: 'showcase_change_status',
    label: 'Change Status',
    icon: 'arrow-right-circle',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      {
        name: 'new_status', label: 'New Status', type: 'select' as const, required: true,
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Active', value: 'active' },
          { label: 'Review', value: 'review' },
          { label: 'Completed', value: 'completed' },
          { label: 'Archived', value: 'archived' },
        ],
      },
    ],
    refreshAfter: true,
    successMessage: 'Status updated',
  },
  {
    name: 'showcase_assign_owner',
    label: 'Assign Owner',
    icon: 'user-plus',
    type: 'api' as const,
    locations: ['record_header' as const],
    params: [
      { name: 'owner_email', label: 'Owner Email', type: 'email' as const, required: true },
      { name: 'notify', label: 'Send Notification', type: 'boolean' as const },
    ],
    refreshAfter: true,
    successMessage: 'Owner assigned',
  },
  {
    name: 'showcase_archive',
    label: 'Archive',
    icon: 'archive',
    type: 'api' as const,
    locations: ['record_more' as const],
    variant: 'danger' as const,
    confirmText: 'Are you sure you want to archive this item?',
    refreshAfter: true,
    successMessage: 'Item archived',
  },
];
