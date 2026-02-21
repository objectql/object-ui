export const OpportunityContactView = {
  listViews: {
    all: {
      name: 'all',
      label: 'All Opportunity Contacts',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'opportunity_contact' },
      columns: ['name', 'opportunity', 'contact', 'role', 'is_primary'],
      sort: [{ field: 'opportunity', order: 'asc' as const }],
    },
  },
  form: {
    data: { provider: 'object' as const, object: 'opportunity_contact' },
    sections: [
      {
        label: 'Relationship',
        columns: '2' as const,
        fields: ['name', 'opportunity', 'contact', 'role', 'is_primary'],
      },
    ],
  },
};
