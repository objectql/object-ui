export const ContactView = {
  listViews: {
    all_contacts: {
      name: 'all_contacts',
      label: 'All Contacts',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'contact' },
      columns: ['name', 'email', 'phone', 'title', 'account', 'status', 'priority'],
      sort: [{ field: 'name', order: 'asc' as const }],
    },
    active_contacts: {
      name: 'active_contacts',
      label: 'Active Contacts',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'contact' },
      columns: ['name', 'email', 'title', 'account', 'status'],
      filter: ['is_active', '=', true],
    },
  },
  form: {
    data: { provider: 'object' as const, object: 'contact' },
    sections: [
      {
        label: 'Personal Information',
        columns: '2' as const,
        fields: ['avatar', 'name', 'email', 'phone', 'title', 'department', 'company'],
      },
      {
        label: 'Account & Status',
        columns: '2' as const,
        fields: ['account', 'status', 'priority', 'lead_source', 'is_active', 'do_not_call'],
      },
      {
        label: 'Address & Social',
        columns: '2' as const,
        fields: ['address', 'linkedin', 'birthdate', 'latitude', 'longitude'],
      },
      {
        label: 'Notes',
        columns: '1' as const,
        collapsible: true,
        fields: ['notes'],
      },
    ],
  },
};
