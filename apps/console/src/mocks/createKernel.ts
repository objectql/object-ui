/**
 * Shared Kernel Factory for MSW Mock Environment
 *
 * Creates a fully bootstrapped ObjectStack kernel for use in both
 * browser (MSW setupWorker) and test (MSW setupServer) environments.
 *
 * Uses MSWPlugin from @objectstack/plugin-msw to expose the full
 * ObjectStack protocol via MSW. This ensures filter/sort/top/pagination
 * work identically to server mode.
 *
 * Follows the same pattern as @objectstack/studio's createKernel —
 * see https://github.com/objectstack-ai/spec
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver, MemoryAnalyticsService } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
import type { MSWPluginOptions } from '@objectstack/plugin-msw';
import type { Cube } from '@objectstack/spec/data';
import { http, HttpResponse } from 'msw';

export interface KernelOptions {
  /** Application configuration (defineStack output) */
  appConfig: any;
  /** Whether to skip system validation (useful in browser) */
  skipSystemValidation?: boolean;
  /** MSWPlugin options; when provided, MSWPlugin is added to the kernel. */
  mswOptions?: MSWPluginOptions;
  /**
   * InMemoryDriver persistence configuration.
   *
   * - `'auto'` (default) — auto-detect environment (browser → localStorage, Node.js → file)
   * - `'local'` — force localStorage persistence (browser only)
   * - `false` — disable persistence entirely (useful in tests)
   *
   * When omitted, defaults to `'auto'`.
   */
  persistence?: false | 'auto' | 'local' | 'file';
}

export interface KernelResult {
  kernel: ObjectKernel;
  driver: InMemoryDriver;
  /** The MSWPlugin instance (if mswOptions was provided). */
  mswPlugin?: MSWPlugin;
}

/**
 * Install a lightweight broker shim on the kernel so that
 * HttpDispatcher (used by MSWPlugin) can route data/metadata
 * calls through the ObjectStack protocol service.
 *
 * A full Moleculer-based broker is only available in server mode
 * (HonoServerPlugin). In MSW/browser mode we bridge the gap with
 * this thin adapter that delegates to the protocol service.
 */
async function installBrokerShim(kernel: ObjectKernel): Promise<void> {
  let protocol: any;
  try {
    protocol = await kernel.getService('protocol');
  } catch {
    return;
  }
  if (!protocol) return;

  (kernel as any).broker = {
    async call(action: string, params: any = {}) {
      const [service, method] = action.split('.');

      if (service === 'data') {
        switch (method) {
          case 'query':
            return protocol.findData({ object: params.object, query: params.query ?? params });
          case 'get':
            return protocol.getData({ object: params.object, id: params.id });
          case 'create':
            return protocol.createData({ object: params.object, data: params.data });
          case 'update':
            return protocol.updateData({ object: params.object, id: params.id, data: params.data });
          case 'delete':
            return protocol.deleteData({ object: params.object, id: params.id });
          case 'batch':
            return protocol.batchData?.({ object: params.object, ...params }) ?? { results: [] };
        }
      }

      if (service === 'metadata') {
        if (method === 'types') return protocol.getMetaTypes({});
        if (method === 'getObject') {
          return protocol.getMetaItem({ type: 'object', name: params.objectName });
        }
        if (method === 'saveItem') {
          return protocol.saveMetaItem?.({ type: params.type, name: params.name, item: params.item });
        }
        if (method.startsWith('get')) {
          const type = method.replace('get', '').toLowerCase();
          return protocol.getMetaItem({ type, name: params.name });
        }
        // list-style calls: metadata.objects, metadata.apps, etc.
        return protocol.getMetaItems({ type: method, packageId: params.packageId });
      }

      // Analytics service calls (e.g. analytics.query, analytics.meta)
      if (service === 'analytics') {
        let analytics: any;
        try { analytics = await kernel.getService('analytics'); } catch { /* noop */ }
        if (analytics) {
          if (method === 'query') return analytics.query(params);
          if (method === 'meta') return analytics.getMeta(params?.cubeName);
          if (method === 'sql') return analytics.generateSql(params);
        }
      }

      // i18n service calls (e.g. i18n.getTranslations)
      if (service === 'i18n') {
        let i18nService: any;
        try { i18nService = await kernel.getService('i18n'); } catch { /* noop */ }
        if (i18nService) {
          if (method === 'getTranslations') return i18nService.getTranslations(params?.lang);
        }
      }

      throw new Error(`[BrokerShim] Unhandled action: ${action}`);
    },
  };
}

/**
 * Sync `_id` ↔ `id` on all records in the InMemoryDriver.
 *
 * The canonical primary key is `id` (per objectstack-ai/spec).
 * For backward compatibility with Mongo/Mingo storage layers, we
 * keep `_id` in sync as an alias.
 *
 * When seed data provides an explicit `id`, `_id` is derived from it.
 * When legacy seed data only provides `_id`, that value is promoted
 * to `id` so lookups work correctly.
 */
function syncDriverIds(driver: InMemoryDriver): void {
  const db = (driver as any).db as Record<string, any[]>;
  for (const records of Object.values(db)) {
    for (const record of records) {
      if (record.id != null && record.id !== record._id) {
        // Canonical id present → derive _id for backward compat
        record._id = record.id;
      } else if (record._id != null && !record.id) {
        // Legacy seed data with only _id → promote to canonical id
        record.id = record._id;
      }
    }
  }
}

/**
 * Wrap the driver's `create` method so that every newly created
 * record also gets `_id` set to the same value as `id`.
 */
function patchDriverCreate(driver: InMemoryDriver): void {
  const originalCreate = driver.create.bind(driver);
  (driver as any).create = async (object: string, data: any, options?: any) => {
    const result = await originalCreate(object, data, options);
    // Patch the stored record in-place
    const table = (driver as any).db[object] as any[] | undefined;
    if (table) {
      const stored = table[table.length - 1];
      if (stored && stored.id === result.id) {
        stored._id = stored.id;
      }
    }
    // Also patch the returned copy
    if (!(result as any)._id) (result as any)._id = result.id;
    return result;
  };
}

/**
 * Build cube definitions from the appConfig objects.
 *
 * Scans objects for numeric/currency fields and generates a Cube per object
 * with sensible default measures (count + sum/avg for each numeric field)
 * and dimensions (all non-numeric scalar fields).
 *
 * Only used in demo/MSW/dev environments to provide out-of-the-box
 * analytics without requiring explicit cube configuration.
 */
function buildCubesFromConfig(appConfig: any): Cube[] {
  const objects: any[] = appConfig?.objects ?? [];
  const cubes: Cube[] = [];

  for (const obj of objects) {
    if (!obj?.name || !obj?.fields) continue;

    const measures: Record<string, any> = {
      count: {
        name: 'count',
        label: 'Count',
        type: 'count' as const,
        sql: 'id',
      },
    };

    const dimensions: Record<string, any> = {};

    for (const [fieldName, fieldDef] of Object.entries<any>(obj.fields)) {
      if (!fieldDef) continue;
      const fType = fieldDef.type;

      // Numeric / currency / percent fields → aggregate measures
      if (fType === 'currency' || fType === 'number' || fType === 'percent') {
        measures[`${fieldName}_sum`] = {
          name: `${fieldName}_sum`,
          label: `${fieldDef.label ?? fieldName} (Sum)`,
          type: 'sum' as const,
          sql: fieldName,
        };
        measures[`${fieldName}_avg`] = {
          name: `${fieldName}_avg`,
          label: `${fieldDef.label ?? fieldName} (Avg)`,
          type: 'avg' as const,
          sql: fieldName,
        };
      }

      // Scalar fields → dimensions for grouping
      if (fType === 'text' || fType === 'select' || fType === 'boolean') {
        dimensions[fieldName] = {
          name: fieldName,
          label: fieldDef.label ?? fieldName,
          type: fType === 'boolean' ? ('boolean' as const) : ('string' as const),
          sql: fieldName,
        };
      }

      // Date/datetime fields → time dimensions
      if (fType === 'date' || fType === 'datetime') {
        dimensions[fieldName] = {
          name: fieldName,
          label: fieldDef.label ?? fieldName,
          type: 'time' as const,
          sql: fieldName,
          granularities: ['day', 'week', 'month', 'quarter', 'year'],
        };
      }
    }

    cubes.push({
      name: String(obj.name),
      title: obj.label ? String(obj.label) : undefined,
      description: obj.description ? String(obj.description) : undefined,
      sql: String(obj.name), // table name matches object name in InMemoryDriver
      measures,
      dimensions,
    } as Cube);
  }

  return cubes;
}

/** Per-language translation map: language code → translation tree. */
type TranslationMap = Record<string, Record<string, unknown>>;

/** A named translation bundle as declared in a stack's i18n config. */
interface I18nBundle {
  namespace: string;
  translations: TranslationMap;
}

/**
 * Resolve translations for a given language from the i18n bundles
 * declared in the application configuration.
 *
 * Each bundle carries a `namespace` (e.g. "crm") and a `translations`
 * map keyed by language code.  The resolved output nests each bundle's
 * translations under its namespace so that i18next sees keys like
 * `crm.objects.account.label`.
 */
function resolveI18nTranslations(
  bundles: I18nBundle[],
  lang: string,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const bundle of bundles) {
    const langTranslations = bundle.translations[lang];
    if (langTranslations) {
      merged[bundle.namespace] = langTranslations;
    }
  }
  return merged;
}

/**
 * Create and bootstrap an ObjectStack kernel with in-memory driver.
 *
 * This is the single factory used by both browser.ts and server.ts
 * so that kernel setup logic is not duplicated.
 */
export async function createKernel(options: KernelOptions): Promise<KernelResult> {
  const { appConfig, skipSystemValidation = true, mswOptions, persistence } = options;

  const driver = new InMemoryDriver(
    persistence !== undefined ? { persistence } : undefined,
  );

  const kernel = new ObjectKernel({
    skipSystemValidation
  });

  await kernel.use(new ObjectQLPlugin());
  await kernel.use(new DriverPlugin(driver, 'memory'));
  await kernel.use(new AppPlugin(appConfig));

  // Register MemoryAnalyticsService so that HttpDispatcher can serve
  // /api/v1/analytics/* endpoints in demo/MSW/dev environments.
  // Without this, analytics routes return 405 because the kernel has
  // no 'analytics' service and the dispatcher skips the handler.
  const cubes = buildCubesFromConfig(appConfig);
  const memoryAnalytics = new MemoryAnalyticsService({ driver, cubes });
  kernel.registerService('analytics', {
    query: (query: any) => memoryAnalytics.query(query),
    getMeta: (cubeName?: string) => memoryAnalytics.getMeta(cubeName),
    // HttpDispatcher calls getMetadata(); adapt to MemoryAnalyticsService.getMeta()
    getMetadata: () => memoryAnalytics.getMeta(),
    generateSql: (query: any) => memoryAnalytics.generateSql(query),
  });

  // ── i18n service registration ──────────────────────────────────────
  // Read translation bundles from the app config (populated by each stack's
  // `i18n: { namespace, translations }` field and merged via sharedConfig).
  // This ensures both MSW/mock and server modes share the same translation
  // resolution pipeline — no manual per-environment i18n handlers required.
  const i18nBundles: I18nBundle[] = appConfig.i18n?.bundles ?? [];

  if (i18nBundles.length > 0) {
    // Build a complete i18n service that satisfies both:
    //  - HttpDispatcher.handleI18n (calls getTranslations, getLocales)
    //  - AppPlugin.loadTranslations (calls loadTranslations, setDefaultLocale)
    // In MSW mode the custom handler serves translations directly, but the
    // kernel service is still needed for the broker shim and dispatcher paths.
    const appPluginTranslations = new Map<string, Record<string, unknown>>();
    let defaultLocale = 'en';

    kernel.registerService('i18n', {
      getTranslations: (lang: string) => {
        const resolved = resolveI18nTranslations(i18nBundles, lang);
        const extra = appPluginTranslations.get(lang);
        if (extra) {
          // Shallow merge: AppPlugin-loaded translations override bundle translations
          return { ...resolved, ...extra };
        }
        return resolved;
      },
      loadTranslations: (locale: string, data: Record<string, unknown>) => {
        const existing = appPluginTranslations.get(locale) ?? {};
        appPluginTranslations.set(locale, { ...existing, ...data });
      },
      getLocales: () => {
        // Collect all available locales from bundles + any loaded via loadTranslations
        const locales = new Set<string>();
        for (const bundle of i18nBundles) {
          for (const lang of Object.keys(bundle.translations)) {
            locales.add(lang);
          }
        }
        for (const lang of appPluginTranslations.keys()) {
          locales.add(lang);
        }
        return [...locales];
      },
      getDefaultLocale: () => defaultLocale,
      setDefaultLocale: (locale: string) => { defaultLocale = locale; },
    });
  }

  let mswPlugin: MSWPlugin | undefined;
  if (mswOptions) {
    // Install a protocol-based broker shim BEFORE MSWPlugin's start phase
    // so that HttpDispatcher (inside MSWPlugin) can resolve data/metadata
    // calls without requiring a full Moleculer broker.
    await installBrokerShim(kernel);

    // Auto-inject the i18n REST handler when translations are declared in
    // the app config, so callers (browser.ts / server.ts) no longer need
    // to manually construct a custom i18n MSW route.
    const effectiveOptions = { ...mswOptions };
    if (i18nBundles.length > 0) {
      const baseUrl = mswOptions.baseUrl ?? '';
      const i18nHandler = http.get(
        `${baseUrl}/i18n/translations/:lang`,
        ({ params }) => {
          const lang = params.lang as string;
          const translations = resolveI18nTranslations(i18nBundles, lang);
          return HttpResponse.json({
            data: { locale: lang, translations },
          });
        },
      );
      effectiveOptions.customHandlers = [
        i18nHandler,
        ...(mswOptions.customHandlers ?? []),
      ];
    }

    mswPlugin = new MSWPlugin(effectiveOptions);
    await kernel.use(mswPlugin);
  }

  await kernel.bootstrap();

  // After bootstrap, sync _id with id for all seed-data records and
  // wrap create() so that new records also get _id = id.
  syncDriverIds(driver);
  patchDriverCreate(driver);

  // Re-install broker shim after bootstrap to ensure the protocol service
  // is fully initialised (some plugins register services during start phase).
  if (mswOptions) {
    await installBrokerShim(kernel);
  }

  // Initialise persistence adapter and load any previously persisted data.
  // On first load this is a no-op (empty localStorage); on subsequent page
  // refreshes the persisted data overwrites the seed data so that user
  // changes survive a browser reload.
  await driver.connect();

  // Ensure the current database state (seed data on first load, or the
  // just-restored persisted snapshot) is flushed to the persistence layer
  // so that localStorage always contains the latest data.
  await driver.flush();

  return { kernel, driver, mswPlugin };
}
