import { defineStack } from '@objectstack/spec';
import crmConfigImport from '@object-ui/example-crm/objectstack.config';
import todoConfigImport from '@object-ui/example-todo/objectstack.config';
import kitchenSinkConfigImport from '@object-ui/example-kitchen-sink/objectstack.config';
import { hotcrmObjects, hotcrmApps, mergeObjects } from '../../examples/hotcrm-bridge.js';

const crmConfig = (crmConfigImport as any).default || crmConfigImport;
const todoConfig = (todoConfigImport as any).default || todoConfigImport;
const kitchenSinkConfig = (kitchenSinkConfigImport as any).default || kitchenSinkConfigImport;

// Patch CRM App Navigation to include Report using a supported navigation type
// (type: 'url' passes schema validation while still routing correctly via React Router)
const crmApps = crmConfig.apps ? JSON.parse(JSON.stringify(crmConfig.apps)) : [];
if (crmApps.length > 0) {
    const crmApp = crmApps[0];
    if (crmApp && crmApp.navigation) {
        // Insert report after dashboard
        const dashboardIdx = crmApp.navigation.findIndex((n: any) => n.id === 'nav_dashboard');
        const insertIdx = dashboardIdx !== -1 ? dashboardIdx + 1 : 0;
        crmApp.navigation.splice(insertIdx, 0, {
            id: 'nav_sales_report',
            type: 'url',
            url: '/apps/crm_app/report/sales_performance_q1',
            label: 'Sales Report',
            icon: 'file-bar-chart'
        });
    }
}

export const sharedConfig = {
  // ============================================================================
  // Project Metadata
  // ============================================================================
  
  name: '@object-ui/console',
  version: '0.1.0',
  description: 'ObjectStack Console',
  
  // ============================================================================
  // Merged Stack Configuration (CRM + Todo + Kitchen Sink + HotCRM + Mock Metadata)
  // ============================================================================
  objects: mergeObjects(
    [
      ...(crmConfig.objects || []),
      ...(todoConfig.objects || []),
      ...(kitchenSinkConfig.objects || []),
    ],
    hotcrmObjects,
  ),
  apps: [
    ...crmApps,
    ...(todoConfig.apps || []),
    ...(kitchenSinkConfig.apps || []),
    ...hotcrmApps,
  ],
  dashboards: [
    ...(crmConfig.dashboards || []),
    ...(todoConfig.dashboards || []),
    ...(kitchenSinkConfig.dashboards || [])
  ],
  reports: [
    ...(crmConfig.reports || []),
    // Manually added report since CRM config validation prevents it
    {
      name: 'sales_performance_q1',
      label: 'Q1 Sales Performance',
      description: 'Quarterly analysis of sales revenue by region and product line',
      type: 'report',
      title: 'Q1 Sales Performance Report',
      sections: [
        {
          type: 'header',
          title: 'Executive Summary',
          subtitle: 'Generated on Feb 6, 2026' 
        },
        {
          type: 'summary',
          title: 'Key Metrics',
          metrics: [
             { label: 'Total Revenue', value: '$1,240,000', change: 12, trend: 'up' },
             { label: 'Deals Closed', value: '45', change: 5, trend: 'up' },
             { label: 'Avg Deal Size', value: '$27,500', change: -2, trend: 'down' }
          ]
        },
        {
          type: 'chart',
          title: 'Revenue Trend',
          chart: {
             chartType: 'line',
             title: 'Monthly Revenue',
             xAxisField: 'month',
             yAxisFields: ['revenue'],
             data: [
                { month: 'Jan', revenue: 320000 },
                { month: 'Feb', revenue: 450000 },
                { month: 'Mar', revenue: 470000 }
             ]
          }
        },
        {
          type: 'section',
          title: 'Regional Breakdown',
          content: 'North America continues to lead with 45% of total revenue, followed by EMEA at 30%.'
        }
      ]
    } as any
  ],
  pages: [
    ...(crmConfig.pages || []),
    ...(todoConfig.pages || []),
    ...(kitchenSinkConfig.pages || [])
  ],
  manifest: {
    data: [
      ...(crmConfig.manifest?.data || []),
      ...(todoConfig.manifest?.data || []),
      ...(kitchenSinkConfig.manifest?.data || [])
    ]
  },
  plugins: [],
  datasources: {
    default: {
      driver: '@objectstack/driver-memory'
    }
  }
};

export default defineStack(sharedConfig as any);
