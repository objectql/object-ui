import type { ObjectStackDefinition } from '@objectstack/spec';
import { composeStacks } from '@object-ui/core';
import crmConfigImport from '@object-ui/example-crm/objectstack.config';
import todoConfigImport from '@object-ui/example-todo/objectstack.config';
import kitchenSinkConfigImport from '@object-ui/example-kitchen-sink/objectstack.config';

/** Resolve ESM default-export interop without `as any`. */
type MaybeDefault<T> = T | { default: T };
function resolveDefault<T>(mod: MaybeDefault<T>): T {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default: T }).default;
  }
  return mod as T;
}

const crmConfig = resolveDefault<ObjectStackDefinition>(crmConfigImport);
const todoConfig = resolveDefault<ObjectStackDefinition>(todoConfigImport);
const kitchenSinkConfig = resolveDefault<ObjectStackDefinition>(kitchenSinkConfigImport);

// Single-pass composition: composeStacks handles object deduplication (override),
// views→objects mapping, and actions→objects assignment via objectName.
// No defineStack() validation pass — it would strip runtime properties (listViews,
// actions) from objects, requiring a double-pass hack to restore them.
const composed = composeStacks(
  [crmConfig, todoConfig, kitchenSinkConfig] as Record<string, any>[],
  { objectConflict: 'override' },
);

// Patch CRM App Navigation to include Report using a supported navigation type
// (type: 'url' passes schema validation while still routing correctly via React Router)
const apps = JSON.parse(JSON.stringify(composed.apps || []));
const crmApp = apps.find((a: any) => a.name === 'crm_app');
if (crmApp?.navigation) {
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

export const sharedConfig = {
  // ============================================================================
  // Project Metadata
  // ============================================================================
  
  name: '@object-ui/console',
  version: '0.1.0',
  description: 'ObjectStack Console',
  
  // ============================================================================
  // Merged Stack Configuration (CRM + Todo + Kitchen Sink)
  // ============================================================================
  objects: composed.objects,
  apps,
  dashboards: composed.dashboards,
  reports: [
    ...(composed.reports || []),
    // Console-specific report not in any example stack
    {
      name: 'sales_performance_q1',
      label: 'Q1 Sales Performance',
      description: 'Quarterly analysis of sales revenue by region and product line',
      objectName: 'opportunity',
      type: 'summary',
      columns: [
        { field: 'name', label: 'Deal Name' },
        { field: 'amount', label: 'Amount', aggregate: 'sum' },
        { field: 'stage', label: 'Stage' },
        { field: 'close_date', label: 'Close Date' }
      ]
    }
  ],
  pages: composed.pages,
  manifest: {
    id: 'com.objectui.console',
    version: '0.1.0',
    type: 'app',
    name: '@object-ui/console',
    data: composed.manifest.data,
  },
  plugins: [],
  datasources: [
    {
      name: 'default',
      driver: '@objectstack/driver-memory',
      config: {}
    }
  ]
};

export default sharedConfig;
