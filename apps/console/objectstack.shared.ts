import { defineStack } from '@objectstack/spec';
import type { ObjectStackDefinition } from '@objectstack/spec';
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

// ---------------------------------------------------------------------------
// Merge stack-level views into object definitions.
// The @objectstack/spec defines views at the stack level (views[].listViews),
// but the runtime protocol serves objects without listViews. This helper
// merges listViews from the views array into the corresponding objects so
// the console can render the correct view type when switching views.
// ---------------------------------------------------------------------------
function mergeViewsIntoObjects(objects: any[], configs: any[]): any[] {
  // Collect all listViews grouped by object name
  const viewsByObject: Record<string, Record<string, any>> = {};
  for (const config of configs) {
    if (!Array.isArray(config.views)) continue;
    for (const view of config.views) {
      if (!view.listViews) continue;
      for (const [viewName, listView] of Object.entries(view.listViews as Record<string, any>)) {
        const objectName = listView?.data?.object;
        if (!objectName) continue;
        if (!viewsByObject[objectName]) viewsByObject[objectName] = {};
        viewsByObject[objectName][viewName] = listView;
      }
    }
  }

  // Merge into objects
  return objects.map((obj: any) => {
    const views = viewsByObject[obj.name];
    if (!views) return obj;
    return { ...obj, listViews: { ...(obj.listViews || {}), ...views } };
  });
}

const allConfigs = [crmConfig, todoConfig, kitchenSinkConfig];

export const sharedConfig = {
  // ============================================================================
  // Project Metadata
  // ============================================================================
  
  name: '@object-ui/console',
  version: '0.1.0',
  description: 'ObjectStack Console',
  
  // ============================================================================
  // Merged Stack Configuration (CRM + Todo + Kitchen Sink + Mock Metadata)
  // ============================================================================
  objects: mergeViewsIntoObjects(
    [
      ...(crmConfig.objects || []),
      ...(todoConfig.objects || []),
      ...(kitchenSinkConfig.objects || []),
    ],
    allConfigs,
  ),
  apps: [
    ...crmApps,
    ...(todoConfig.apps || []),
    ...(kitchenSinkConfig.apps || []),
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
  pages: [
    ...(crmConfig.pages || []),
    ...(todoConfig.pages || []),
    ...(kitchenSinkConfig.pages || [])
  ],
  manifest: {
    id: 'com.objectui.console',
    version: '0.1.0',
    type: 'app',
    name: '@object-ui/console',
    data: [
      ...(crmConfig.manifest?.data || []),
      ...(todoConfig.manifest?.data || []),
      ...(kitchenSinkConfig.manifest?.data || [])
    ]
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

export default defineStack(sharedConfig as Parameters<typeof defineStack>[0]);
