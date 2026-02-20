export const ContactActions = [
  {
    name: 'contact_send_email',
    label: 'Send Email',
    icon: 'mail',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      { name: 'subject', label: 'Subject', type: 'text' as const, required: true },
      { name: 'body', label: 'Message', type: 'textarea' as const },
    ],
    successMessage: 'Email sent successfully',
  },
  {
    name: 'contact_convert_to_customer',
    label: 'Convert to Customer',
    icon: 'user-check',
    type: 'api' as const,
    locations: ['record_header' as const],
    confirmText: 'Convert this contact to a customer?',
    refreshAfter: true,
    successMessage: 'Contact converted to customer',
  },
  {
    name: 'contact_log_call',
    label: 'Log a Call',
    icon: 'phone',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      { name: 'call_subject', label: 'Subject', type: 'text' as const, required: true },
      { name: 'call_notes', label: 'Notes', type: 'textarea' as const },
      { name: 'call_duration', label: 'Duration (min)', type: 'number' as const },
    ],
    successMessage: 'Call logged successfully',
  },
];
