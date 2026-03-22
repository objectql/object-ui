import type { ObjectStackDefinition } from '@objectstack/spec';
import { composeStacks } from '@objectstack/spec';
import { mergeViewsIntoObjects } from '@object-ui/core';
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

const allConfigs = [crmConfig, todoConfig, kitchenSinkConfig];

// Aggregate seed data from all manifest.data arrays (spec selects one manifest,
// so we collect data from all stacks before composing).
const allData = allConfigs.flatMap((c: any) => c.manifest?.data || c.data || []);

// Aggregate i18n bundles from all stacks that declare an i18n section.
// Each bundle carries a namespace (e.g. 'crm') and per-language translations.
const i18nBundles = allConfigs
  .map((c: any) => c.i18n)
  .filter((i: any) => i?.namespace && i?.translations);

// Build the spec `translations` array for the runtime's AppPlugin.
// AppPlugin.loadTranslations expects `translations: Array<{ [locale]: data }>`.
// Each locale's data is nested under the bundle's namespace so that
// both the server-mode (AppPlugin → memory i18n) and MSW-mode (createKernel)
// produce the same structure: `{ crm: { objects: { ... } } }`.
const specTranslations: Record<string, any>[] = i18nBundles.map((bundle: any) => {
  const result: Record<string, any> = {};
  for (const [locale, data] of Object.entries(bundle.translations)) {
    result[locale] = { [bundle.namespace]: data };
  }
  return result;
});

// Protocol-level composition via @objectstack/spec: handles object dedup,
// array concatenation, actions→objects mapping, and manifest selection.
const composed = composeStacks(allConfigs as any[], { objectConflict: 'override' }) as any;

// Adapter: merge views[].listViews into object definitions for the runtime.
if (composed.objects && composed.views) {
  composed.objects = mergeViewsIntoObjects(composed.objects, composed.views);
}

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
    data: allData,
  },
  i18n: {
    bundles: i18nBundles,
    defaultLocale: 'en',
  },
  // Spec-format translations array consumed by AppPlugin.loadTranslations()
  // in real-server mode (pnpm start). Each entry maps locale → namespace-scoped
  // translation data so the runtime's memory i18n fallback serves the same
  // structure as the MSW mock handler.
  translations: specTranslations,
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
