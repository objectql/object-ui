export const AccountActions = [
  {
    name: 'account_send_email',
    label: 'Send Email',
    icon: 'mail',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      { name: 'to', label: 'To Email', type: 'email' as const, required: true },
      { name: 'subject', label: 'Subject', type: 'text' as const, required: true },
      { name: 'body', label: 'Message', type: 'textarea' as const },
    ],
    successMessage: 'Email sent successfully',
  },
  {
    name: 'account_assign_owner',
    label: 'Assign Owner',
    icon: 'user-plus',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      { name: 'owner_id', label: 'New Owner', type: 'lookup' as const, required: true },
    ],
    refreshAfter: true,
    successMessage: 'Owner assigned successfully',
  },
  {
    name: 'account_merge',
    label: 'Merge Accounts',
    icon: 'git-merge',
    type: 'api' as const,
    locations: ['record_more' as const],
    confirmText: 'Are you sure you want to merge these accounts? This action cannot be undone.',
    variant: 'danger' as const,
    refreshAfter: true,
  },
];
