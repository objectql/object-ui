/**
 * Root Development Configuration
 *
 * Aggregates all example apps for `pnpm serve` / `pnpm dev:server`.
 * This is NOT a deployable config — it's the monorepo dev entry point.
 *
 * Console supports two running modes:
 *   - MSW:    `pnpm dev`        — Vite dev server with MSW intercepting API calls in browser
 *   - Server: `pnpm dev:server` — Real ObjectStack API server + Vite console proxying to it
 *
 * Plugins: Each example app exports a plugin class (CRMPlugin, TodoPlugin,
 * KitchenSinkPlugin) that implements the AppMetadataPlugin interface.
 * For standalone use, each plugin can be loaded independently via
 * `kernel.use(new CRMPlugin())`. In the dev workspace, we collect their
 * configs via `getConfig()` and merge them with `composeStacks()`.
 */
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { ConsolePlugin } from '@object-ui/console';
import { composeStacks } from '@objectstack/spec';
import { mergeViewsIntoObjects } from '@object-ui/core';
import { createMemoryI18n } from '@objectstack/core';
import { CRMPlugin } from './examples/crm/plugin';
import { TodoPlugin } from './examples/todo/plugin';
import { KitchenSinkPlugin } from './examples/kitchen-sink/plugin';

// Instantiate example plugins
const plugins = [new CRMPlugin(), new TodoPlugin(), new KitchenSinkPlugin()];

// Collect raw configs from each plugin via getConfig()
const allConfigs = plugins.map((p) => {
  const raw = p.getConfig();
  return (raw as any).default || raw;
});

// Aggregate seed data from all manifest.data arrays (spec selects one manifest,
// so we collect data from all stacks before composing).
const allData = allConfigs.flatMap((c: any) => c.manifest?.data || c.data || []);

// Aggregate i18n bundles from all stacks that declare an i18n section.
// Each bundle carries a namespace (e.g. 'crm') and per-language translations.
const i18nBundles = allConfigs
  .map((c: any) => c.i18n)
  .filter((i: any) => i?.namespace && i?.translations);

// Build the spec `translations` array for AppPlugin.loadTranslations().
// Format: Array<{ [locale]: { namespace: data } }>.
// Each locale's data is nested under the bundle's namespace so that the
// i18n service serves `{ crm: { objects: { account: { label: '客户' } } } }`.
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

const mergedApp = {
  ...composed,
  manifest: {
    id: 'dev-workspace',
    name: 'dev_workspace',
    version: '0.0.0',
    description: 'ObjectUI monorepo development workspace',
    type: 'app',
    data: allData,
  },
  // Spec-format translations consumed by AppPlugin.loadTranslations() in server mode
  translations: specTranslations,
  i18n: {
    bundles: i18nBundles,
    defaultLocale: 'en',
  },
};

/**
 * Registers the in-memory i18n service during the init phase (Phase 1)
 * so that AppPlugin.start() → loadTranslations() (Phase 2) can find
 * and load translation bundles. Without this, the kernel's memory i18n
 * fallback only registers in validateSystemRequirements() — too late.
 */
class MemoryI18nPlugin {
  readonly name = 'com.objectstack.service.i18n';
  readonly version = '1.0.0';
  readonly type = 'service' as const;

  init(ctx: any) {
    const svc = createMemoryI18n();
    ctx.registerService('i18n', svc);
  }
}

// Export only plugins — no top-level objects/manifest/apps.
// The CLI auto-creates an AppPlugin from the config if it detects objects/manifest/apps,
// which would conflict with our explicit AppPlugin and skip seed data loading.
export default {
  plugins: [
    new MemoryI18nPlugin(),
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver()),
    new AppPlugin(mergedApp),
    new AuthPlugin({
      secret: process.env.AUTH_SECRET || 'objectui-dev-secret',
      baseUrl: 'http://localhost:3000',
    }),
    new HonoServerPlugin({ port: 3000 }),
    new ConsolePlugin(),
  ],
};
