export const UserActions = [
  {
    name: 'user_reset_password',
    label: 'Reset Password',
    icon: 'key',
    type: 'api' as const,
    locations: ['record_header' as const, 'record_more' as const],
    confirmText: 'Send a password reset link to this user?',
    successMessage: 'Password reset email sent',
  },
  {
    name: 'user_deactivate',
    label: 'Deactivate User',
    icon: 'user-x',
    type: 'api' as const,
    locations: ['record_more' as const],
    variant: 'danger' as const,
    confirmText: 'Are you sure you want to deactivate this user?',
    refreshAfter: true,
    successMessage: 'User deactivated',
  },
];
