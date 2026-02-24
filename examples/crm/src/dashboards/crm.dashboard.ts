export const CrmDashboard = {
  name: 'crm_dashboard',
  label: 'CRM Overview',
  description: 'Revenue metrics, pipeline analytics, and deal insights',
  widgets: [
    // --- KPI Row ---
    {
      title: 'Total Revenue',
      type: 'metric' as const,
      object: 'opportunity',
      layout: { x: 0, y: 0, w: 1, h: 1 },
      options: {
        label: 'Total Revenue',
        value: '$652,000',
        trend: { value: 12.5, direction: 'up' as const, label: 'vs last month' },
        icon: 'DollarSign'
      }
    },
    {
      title: 'Active Deals',
      type: 'metric' as const,
      object: 'opportunity',
      layout: { x: 1, y: 0, w: 1, h: 1 },
      options: {
        label: 'Active Deals',
        value: '5',
        trend: { value: 2.1, direction: 'down' as const, label: 'vs last month' },
        icon: 'Briefcase'
      }
    },
    {
      title: 'Win Rate',
      type: 'metric' as const,
      object: 'opportunity',
      layout: { x: 2, y: 0, w: 1, h: 1 },
      options: {
        label: 'Win Rate',
        value: '42%',
        trend: { value: 4.3, direction: 'up' as const, label: 'vs last month' },
        icon: 'Trophy'
      }
    },
    {
      title: 'Avg Deal Size',
      type: 'metric' as const,
      object: 'opportunity',
      layout: { x: 3, y: 0, w: 1, h: 1 },
      options: {
        label: 'Avg Deal Size',
        value: '$93,000',
        trend: { value: 1.2, direction: 'up' as const, label: 'vs last month' },
        icon: 'BarChart3'
      }
    },

    // --- Row 2: Charts ---
    {
        title: 'Revenue Trends',
        type: 'area' as const,
        object: 'opportunity',
        categoryField: 'month',
        valueField: 'revenue',
        aggregate: 'sum',
        layout: { x: 0, y: 1, w: 3, h: 2 },
        options: {
            xField: 'month',
            yField: 'revenue',
            data: {
                provider: 'value' as const,
                items: [
                   { month: 'Jan', revenue: 155000 },
                   { month: 'Feb', revenue: 87000 },
                   { month: 'Mar', revenue: 48000 },
                   { month: 'Apr', revenue: 61000 },
                   { month: 'May', revenue: 55000 },
                   { month: 'Jun', revenue: 67000 },
                   { month: 'Jul', revenue: 72000 }
                ]
            }
        },
    },
    {
        title: 'Lead Source',
        type: 'donut' as const,
        object: 'opportunity',
        categoryField: 'source',
        valueField: 'value',
        aggregate: 'count',
        layout: { x: 3, y: 1, w: 1, h: 2 },
        options: {
            xField: 'source',
            yField: 'value',
            data: {
                provider: 'value' as const,
                items: [
                    { source: 'Web', value: 2 },
                    { source: 'Referral', value: 1 },
                    { source: 'Partner', value: 1 },
                    { source: 'Existing Business', value: 3 }
                ]
            }
        },
    },

    // --- Row 3: More Charts ---
    {
        title: 'Pipeline by Stage',
        type: 'bar' as const,
        object: 'opportunity',
        categoryField: 'stage',
        valueField: 'amount',
        aggregate: 'sum',
        layout: { x: 0, y: 3, w: 2, h: 2 },
        options: {
            xField: 'stage',
            yField: 'amount',
            data: {
                provider: 'value' as const,
                items: [
                    { stage: 'Prospecting', amount: 250000 },
                    { stage: 'Qualification', amount: 35000 },
                    { stage: 'Proposal', amount: 85000 },
                    { stage: 'Negotiation', amount: 45000 },
                    { stage: 'Closed Won', amount: 225000 }
                ]
            }
        },
    },
    {
        title: 'Top Products',
        type: 'bar' as const,
        object: 'product',
        categoryField: 'name',
        valueField: 'sales',
        aggregate: 'sum',
        layout: { x: 2, y: 3, w: 2, h: 2 },
        options: {
            xField: 'name',
            yField: 'sales',
            data: {
                provider: 'value' as const,
                items: [
                    { name: 'Workstation Pro Laptop', sales: 45000 },
                    { name: 'Implementation Service', sales: 32000 },
                    { name: 'Premium Support', sales: 21000 },
                    { name: 'Executive Mesh Chair', sales: 15000 }
                ]
            }
        },
    },

    // --- Row 4: Table ---
    {
        title: 'Recent Opportunities',
        type: 'table' as const,
        object: 'opportunity',
        layout: { x: 0, y: 5, w: 4, h: 2 },
        options: {
            columns: [
                { header: 'Opportunity Name', accessorKey: 'name' }, 
                { header: 'Amount', accessorKey: 'amount' }, 
                { header: 'Stage', accessorKey: 'stage' },
                { header: 'Close Date', accessorKey: 'date' }
            ],
            data: {
                provider: 'value' as const,
                items: [
                   { name: 'Berlin Automation Project', amount: '$250,000', stage: 'Prospecting', date: '2024-09-01' },
                   { name: 'ObjectStack Enterprise License', amount: '$150,000', stage: 'Closed Won', date: '2024-01-15' },
                   { name: 'London Annual Renewal', amount: '$85,000', stage: 'Proposal', date: '2024-05-15' },
                   { name: 'SF Tower Expansion', amount: '$75,000', stage: 'Closed Won', date: '2024-02-28' },
                   { name: 'Global Fin Q1 Upsell', amount: '$45,000', stage: 'Negotiation', date: '2024-03-30' }
                ]
            }
        },
    },

    // --- Row 5: Dynamic KPI from Object Data ---
    {
        title: 'Revenue by Account',
        type: 'bar' as const,
        object: 'opportunity',
        categoryField: 'account',
        valueField: 'total',
        aggregate: 'sum',
        layout: { x: 0, y: 7, w: 4, h: 2 },
        options: {
            xField: 'account',
            yField: 'total',
            data: {
                provider: 'object' as const,
                object: 'opportunity',
                aggregate: { field: 'amount', function: 'sum' as const, groupBy: 'account' }
            }
        },
    }
  ]
};
