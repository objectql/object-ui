export const OpportunityView = {
  listViews: {
    all: {
      name: 'all',
      label: 'All Opportunities',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'opportunity' },
      columns: ['name', 'amount', 'stage', 'close_date', 'probability', 'forecast_category'],
      sort: [{ field: 'close_date', order: 'asc' as const }],
    },
    pipeline: {
      name: 'pipeline',
      label: 'Pipeline',
      type: 'kanban' as const,
      data: { provider: 'object' as const, object: 'opportunity' },
      columns: ['name', 'amount', 'close_date', 'probability'],
      kanban: {
        groupByField: 'stage',
        columns: ['name', 'amount', 'close_date'],
      },
    },
    closing_this_month: {
      name: 'closing_this_month',
      label: 'Closing This Month',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'opportunity' },
      columns: ['name', 'amount', 'stage', 'close_date', 'probability'],
      sort: [{ field: 'close_date', order: 'asc' as const }],
    },
  },
  form: {
    data: { provider: 'object' as const, object: 'opportunity' },
    sections: [
      {
        label: 'Deal Information',
        columns: '2' as const,
        fields: ['name', 'account', 'contacts', 'type', 'lead_source', 'campaign_source'],
      },
      {
        label: 'Financials & Stage',
        columns: '2' as const,
        fields: ['amount', 'expected_revenue', 'probability', 'stage', 'forecast_category'],
      },
      {
        label: 'Timeline',
        columns: '2' as const,
        fields: ['close_date', 'next_step'],
      },
      {
        label: 'Description',
        columns: '1' as const,
        collapsible: true,
        fields: ['description'],
      },
    ],
  },
};
