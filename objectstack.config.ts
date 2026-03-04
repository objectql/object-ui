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
import { ConsolePlugin } from '@object-ui/console';
import { composeStacks } from '@objectstack/spec';
import { CRMPlugin } from './examples/crm/plugin';
import { TodoPlugin } from './examples/todo/plugin';
import { KitchenSinkPlugin } from './examples/kitchen-sink/plugin';

// ---------------------------------------------------------------------------
// Adapter: merge stack-level views (views[].listViews) into object definitions.
// The runtime reads listViews from each object; this bridges the gap until
// the runtime/provider layer handles it natively.
// ---------------------------------------------------------------------------
function mergeViewsIntoObjects(objects: any[], views: any[]): any[] {
  const viewsByObject: Record<string, Record<string, any>> = {};
  for (const view of views) {
    if (!view.listViews) continue;
    for (const [viewName, listView] of Object.entries(view.listViews as Record<string, any>)) {
      const objectName = listView?.data?.object;
      if (!objectName) continue;
      if (!viewsByObject[objectName]) viewsByObject[objectName] = {};
      viewsByObject[objectName][viewName] = listView;
    }
  }
  return objects.map((obj: any) => {
    const v = viewsByObject[obj.name];
    if (!v) return obj;
    return { ...obj, listViews: { ...(obj.listViews || {}), ...v } };
  });
}

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
};

// Export only plugins — no top-level objects/manifest/apps.
// The CLI auto-creates an AppPlugin from the config if it detects objects/manifest/apps,
// which would conflict with our explicit AppPlugin and skip seed data loading.
export default {
  plugins: [
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver()),
    new AppPlugin(mergedApp),
    new HonoServerPlugin({ port: 3000 }),
    new ConsolePlugin(),
  ],
};
