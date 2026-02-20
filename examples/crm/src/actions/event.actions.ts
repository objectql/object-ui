export const EventActions = [
  {
    name: 'event_send_invitation',
    label: 'Send Invitation',
    icon: 'send',
    type: 'api' as const,
    locations: ['record_header' as const],
    params: [
      { name: 'message', label: 'Optional Message', type: 'textarea' as const },
    ],
    successMessage: 'Invitation sent to all participants',
  },
  {
    name: 'event_mark_completed',
    label: 'Mark as Completed',
    icon: 'check-circle',
    type: 'api' as const,
    locations: ['record_header' as const],
    confirmText: 'Mark this event as completed?',
    refreshAfter: true,
    successMessage: 'Event marked as completed',
  },
  {
    name: 'event_cancel',
    label: 'Cancel Event',
    icon: 'x-circle',
    type: 'api' as const,
    locations: ['record_more' as const],
    variant: 'danger' as const,
    params: [
      { name: 'cancel_reason', label: 'Cancellation Reason', type: 'text' as const },
      { name: 'notify_participants', label: 'Notify Participants', type: 'boolean' as const },
    ],
    confirmText: 'Are you sure you want to cancel this event?',
    refreshAfter: true,
    successMessage: 'Event cancelled',
  },
];
