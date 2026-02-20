export const UserView = {
  listViews: {
    all_users: {
      name: 'all_users',
      label: 'All Users',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'user' },
      columns: ['name', 'email', 'role', 'department', 'active'],
      sort: [{ field: 'name', order: 'asc' as const }],
    },
    active_users: {
      name: 'active_users',
      label: 'Active Users',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'user' },
      columns: ['name', 'email', 'role', 'title'],
      filter: ['active', '=', true],
    },
  },
  form: {
    data: { provider: 'object' as const, object: 'user' },
    sections: [
      {
        label: 'Profile',
        columns: '2' as const,
        fields: ['avatar', 'name', 'email', 'username', 'phone'],
      },
      {
        label: 'Role & Department',
        columns: '2' as const,
        fields: ['role', 'title', 'department', 'active'],
      },
      {
        label: 'Bio',
        columns: '1' as const,
        collapsible: true,
        fields: ['bio'],
      },
    ],
  },
};
