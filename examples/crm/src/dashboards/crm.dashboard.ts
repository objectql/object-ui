export const CrmDashboard = {
  name: 'crm_dashboard',
  label: { key: 'crm.dashboard.title', defaultValue: 'CRM Overview' },
  description: 'Revenue metrics, pipeline analytics, and deal insights',
  widgets: [
    // --- KPI Row ---
    // NOTE: `options.value` is a fallback displayed only when no dataSource is
    // available (e.g. demo/storybook mode). In production, the DashboardRenderer
    // routes these to ObjectMetricWidget which fetches live data from the server.
    // If the server request fails, an explicit error state is shown.
    {
      id: 'total_revenue',
      title: { key: 'crm.dashboard.widgets.totalRevenue', defaultValue: 'Total Revenue' },
      type: 'metric' as const,
      object: 'opportunity',
      layout: { x: 0, y: 0, w: 1, h: 1 },
      options: {
        label: 'Total Revenue',
        value: '$652,000',
        trend: { value: 12.5, direction: 'up' as const, label: { key: 'crm.dashboard.trendLabel', defaultValue: 'vs last month' } },
        icon: 'DollarSign'
      }
    },
    {
      id: 'active_deals',
      title: { key: 'crm.dashboard.widgets.activeDeals', defaultValue: 'Active Deals' },
      type: 'metric' as const,
      object: 'opportunity',
      layout: { x: 1, y: 0, w: 1, h: 1 },
      options: {
        label: 'Active Deals',
        value: '5',
        trend: { value: 2.1, direction: 'down' as const, label: { key: 'crm.dashboard.trendLabel', defaultValue: 'vs last month' } },
        icon: 'Briefcase'
      }
    },
    {
      id: 'win_rate',
      title: { key: 'crm.dashboard.widgets.winRate', defaultValue: 'Win Rate' },
      type: 'metric' as const,
      object: 'opportunity',
      layout: { x: 2, y: 0, w: 1, h: 1 },
      options: {
        label: 'Win Rate',
        value: '42%',
        trend: { value: 4.3, direction: 'up' as const, label: { key: 'crm.dashboard.trendLabel', defaultValue: 'vs last month' } },
        icon: 'Trophy'
      }
    },
    {
      id: 'avg_deal_size',
      title: { key: 'crm.dashboard.widgets.avgDealSize', defaultValue: 'Avg Deal Size' },
      type: 'metric' as const,
      object: 'opportunity',
      layout: { x: 3, y: 0, w: 1, h: 1 },
      options: {
        label: 'Avg Deal Size',
        value: '$93,000',
        trend: { value: 1.2, direction: 'up' as const, label: { key: 'crm.dashboard.trendLabel', defaultValue: 'vs last month' } },
        icon: 'BarChart3'
      }
    },

    // --- Row 2: Charts (provider: 'object' — dynamic aggregation) ---
    {
        id: 'revenue_trends',
        title: { key: 'crm.dashboard.widgets.revenueTrends', defaultValue: 'Revenue Trends' },
        type: 'area' as const,
        object: 'opportunity',
        categoryField: 'stage',
        valueField: 'expected_revenue',
        aggregate: 'sum',
        layout: { x: 0, y: 1, w: 3, h: 2 },
        options: {
            xField: 'stage',
            yField: 'expected_revenue',
            data: {
                provider: 'object' as const,
                object: 'opportunity',
                aggregate: { field: 'expected_revenue', function: 'sum' as const, groupBy: 'stage' }
            }
        },
    },
    {
        id: 'lead_source',
        title: { key: 'crm.dashboard.widgets.leadSource', defaultValue: 'Lead Source' },
        type: 'donut' as const,
        object: 'opportunity',
        categoryField: 'lead_source',
        valueField: 'count',
        aggregate: 'count',
        layout: { x: 3, y: 1, w: 1, h: 2 },
        options: {
            xField: 'lead_source',
            yField: 'count',
            data: {
                provider: 'object' as const,
                object: 'opportunity',
                aggregate: { field: 'count', function: 'count' as const, groupBy: 'lead_source' }
            }
        },
    },

    // --- Row 3: More Charts (provider: 'object' — dynamic aggregation) ---
    {
        id: 'pipeline_by_stage',
        title: { key: 'crm.dashboard.widgets.pipelineByStage', defaultValue: 'Pipeline by Stage' },
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
                provider: 'object' as const,
                object: 'opportunity',
                aggregate: { field: 'amount', function: 'sum' as const, groupBy: 'stage' }
            }
        },
    },
    {
        id: 'top_products',
        title: { key: 'crm.dashboard.widgets.topProducts', defaultValue: 'Top Products' },
        type: 'bar' as const,
        object: 'product',
        categoryField: 'category',
        valueField: 'price',
        aggregate: 'sum',
        layout: { x: 2, y: 3, w: 2, h: 2 },
        options: {
            xField: 'category',
            yField: 'price',
            data: {
                provider: 'object' as const,
                object: 'product',
                aggregate: { field: 'price', function: 'sum' as const, groupBy: 'category' }
            }
        },
    },

    // --- Row 4: Table (provider: 'object' — dynamic data) ---
    {
        id: 'recent_opportunities',
        title: { key: 'crm.dashboard.widgets.recentOpportunities', defaultValue: 'Recent Opportunities' },
        type: 'table' as const,
        object: 'opportunity',
        layout: { x: 0, y: 5, w: 4, h: 2 },
        options: {
            columns: [
                { header: 'Opportunity Name', accessorKey: 'name' }, 
                { header: 'Amount', accessorKey: 'amount' }, 
                { header: 'Stage', accessorKey: 'stage' },
                { header: 'Close Date', accessorKey: 'close_date' }
            ],
            data: {
                provider: 'object' as const,
                object: 'opportunity',
            }
        },
    },

    // --- Row 5: Dynamic KPI from Object Data ---
    {
        id: 'revenue_by_account',
        title: { key: 'crm.dashboard.widgets.revenueByAccount', defaultValue: 'Revenue by Account' },
        type: 'bar' as const,
        object: 'opportunity',
        categoryField: 'account',
        valueField: 'amount',
        aggregate: 'sum',
        layout: { x: 0, y: 7, w: 4, h: 2 },
        options: {
            xField: 'account',
            yField: 'amount',
            data: {
                provider: 'object' as const,
                object: 'opportunity',
                aggregate: { field: 'amount', function: 'sum' as const, groupBy: 'account' }
            }
        },
    },

    // --- Row 6: Additional aggregate functions (avg, max) + cross-object ---
    {
        id: 'avg_deal_by_stage',
        title: { key: 'crm.dashboard.widgets.avgDealSizeByStage', defaultValue: 'Avg Deal Size by Stage' },
        type: 'line' as const,
        object: 'opportunity',
        categoryField: 'stage',
        valueField: 'amount',
        aggregate: 'avg',
        layout: { x: 0, y: 9, w: 2, h: 2 },
        options: {
            xField: 'stage',
            yField: 'amount',
            data: {
                provider: 'object' as const,
                object: 'opportunity',
                aggregate: { field: 'amount', function: 'avg' as const, groupBy: 'stage' }
            }
        },
    },
    {
        id: 'orders_by_status',
        title: { key: 'crm.dashboard.widgets.ordersByStatus', defaultValue: 'Orders by Status' },
        type: 'bar' as const,
        object: 'order',
        categoryField: 'status',
        valueField: 'amount',
        aggregate: 'max',
        layout: { x: 2, y: 9, w: 2, h: 2 },
        options: {
            xField: 'status',
            yField: 'amount',
            data: {
                provider: 'object' as const,
                object: 'order',
                aggregate: { field: 'amount', function: 'max' as const, groupBy: 'status' }
            }
        },
    }
  ]
};
