import type { ObjectStackDefinition } from '@objectstack/spec';
import { mergeViewsIntoObjects } from '@object-ui/core';
import { SETUP_APP_DEFAULTS } from '@objectstack/plugin-setup';
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

/**
 * Adapter: prepare a stack config for AppPlugin.
 * - Merges stack-level views into object definitions
 * - Converts i18n translations to the spec format AppPlugin expects
 */
function prepareConfig(config: any) {
  const result = { ...config };
  if (result.objects && result.views) {
    result.objects = mergeViewsIntoObjects(result.objects, result.views);
  }
  if (result.i18n?.namespace && result.i18n?.translations) {
    const ns = result.i18n.namespace;
    const converted: Record<string, any> = {};
    for (const [locale, data] of Object.entries(result.i18n.translations)) {
      converted[locale] = { [ns]: data };
    }
    result.translations = [converted];
  }
  return result;
}

const crmConfig = prepareConfig(resolveDefault<ObjectStackDefinition>(crmConfigImport));
const todoConfig = prepareConfig(resolveDefault<ObjectStackDefinition>(todoConfigImport));
const kitchenSinkConfig = prepareConfig(resolveDefault<ObjectStackDefinition>(kitchenSinkConfigImport));

/**
 * Individual prepared configs for per-plugin AppPlugin loading.
 * Used by createKernel and server-mode objectstack.config.ts.
 */
export const appConfigs = [crmConfig, todoConfig, kitchenSinkConfig];

// Setup App config for registration via AppPlugin (avoids SetupPlugin timing issue)
export const setupAppConfig = {
  apps: [SETUP_APP_DEFAULTS],
  manifest: { id: 'setup', name: 'setup' },
};

/**
 * Additional reports that are not part of any individual app config.
 * Loaded as a separate AppPlugin instance by the mock server (server.ts)
 * and browser mock (browser.ts) so that these reports appear in the
 * kernel's metadata alongside the app-specific reports.
 */
export const customReportsConfig = {
  reports: [
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
  manifest: { id: 'reports', name: 'reports' },
};

// Patch CRM App Navigation to include Report using a supported navigation type
const apps = [
  ...JSON.parse(JSON.stringify(appConfigs.flatMap((c: any) => c.apps || []))),
  SETUP_APP_DEFAULTS,
];
const crmApp = apps.find((a: any) => a.name === 'crm_enterprise');
if (crmApp?.navigation) {
    const dashboardIdx = crmApp.navigation.findIndex((n: any) => n.id === 'nav_dashboard');
    const insertIdx = dashboardIdx !== -1 ? dashboardIdx + 1 : 0;
    crmApp.navigation.splice(insertIdx, 0, {
        id: 'nav_sales_report',
        type: 'url',
        url: '/apps/crm_enterprise/report/sales_performance_q1',
        label: 'Sales Report',
        icon: 'file-bar-chart'
    });
}

// Aggregate i18n bundles from all stacks
const i18nBundles = appConfigs
  .map((c: any) => c.i18n)
  .filter((i: any) => i?.namespace && i?.translations);

// Aggregate seed data across all configs
const allData = appConfigs.flatMap((c: any) => c.manifest?.data || c.data || []);

/**
 * Aggregated sharedConfig for backward compatibility.
 * Used by tests that mock objectstack.shared and by components
 * that need aggregated metadata (apps, objects, etc.).
 */
export const sharedConfig = {
  name: '@object-ui/console',
  version: '0.1.0',
  description: 'ObjectStack Console',

  objects: appConfigs.flatMap((c: any) => c.objects || []),
  apps,
  dashboards: appConfigs.flatMap((c: any) => c.dashboards || []),
  reports: [
    ...appConfigs.flatMap((c: any) => c.reports || []),
    ...customReportsConfig.reports,
  ],
  pages: appConfigs.flatMap((c: any) => c.pages || []),
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
