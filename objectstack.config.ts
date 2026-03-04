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
 * Note: Examples are merged into a single AppPlugin (rather than separate AppPlugins)
 * because CRM and Kitchen Sink both define an `account` object, which would
 * trigger an ownership conflict in the ObjectQL Schema Registry.
 *
 * Plugins: Each example app exports a plugin class (CRMPlugin, TodoPlugin,
 * KitchenSinkPlugin) that implements the AppMetadataPlugin interface.
 * For standalone use, each plugin can be loaded independently via
 * `kernel.use(new CRMPlugin())`. In the dev workspace, we collect their
 * configs via `getConfig()` and merge them into a single AppPlugin.
 */
import { defineStack } from '@objectstack/spec';
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
import { ConsolePlugin } from '@object-ui/console';
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

// Base objects from all plugins
const baseObjects = allConfigs.flatMap((cfg: any) => cfg.objects || []);

// ---------------------------------------------------------------------------
// Merge stack-level views into object definitions.
// defineStack() strips non-standard properties like listViews from objects.
// Re-merge listViews after validation so the runtime protocol serves objects
// with their view definitions (calendar, kanban, etc.).
// ---------------------------------------------------------------------------
function mergeViewsIntoObjects(objects: any[], configs: any[]): any[] {
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
  return objects.map((obj: any) => {
    const views = viewsByObject[obj.name];
    if (!views) return obj;
    return { ...obj, listViews: { ...(obj.listViews || {}), ...views } };
  });
}

// ---------------------------------------------------------------------------
// Merge stack-level actions into object definitions.
// Actions declared at the stack level (actions[]) need to be merged into
// individual object definitions so the runtime protocol (and Console/Studio)
// can render action buttons directly from objectDef.actions.
// Matching uses explicit objectName on the action, or longest object-name
// prefix of the action name (e.g. "account_send_email" → "account").
// ---------------------------------------------------------------------------
function mergeActionsIntoObjects(objects: any[], configs: any[]): any[] {
  const allActions: any[] = [];
  for (const config of configs) {
    if (Array.isArray(config.actions)) {
      allActions.push(...config.actions);
    }
  }
  if (allActions.length === 0) return objects;

  // Sort object names longest-first so "order_item" matches before "order"
  const objectNames = objects.map((o: any) => o.name as string)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const actionsByObject: Record<string, any[]> = {};
  for (const action of allActions) {
    let target: string | undefined = action.objectName;
    if (!target) {
      for (const name of objectNames) {
        if (action.name.startsWith(name + '_')) {
          target = name;
          break;
        }
      }
    }
    if (target) {
      if (!actionsByObject[target]) actionsByObject[target] = [];
      actionsByObject[target].push(action);
    }
  }

  return objects.map((obj: any) => {
    const actions = actionsByObject[obj.name];
    if (!actions) return obj;
    return { ...obj, actions: [...(obj.actions || []), ...actions] };
  });
}

// Merge all plugin configs into a single app bundle for AppPlugin
const mergedApp = defineStack({
  manifest: {
    id: 'dev-workspace',
    name: 'dev_workspace',
    version: '0.0.0',
    description: 'ObjectUI monorepo development workspace',
    type: 'app',
    data: allConfigs.flatMap((cfg: any) => cfg.manifest?.data || []),
  },
  objects: baseObjects,
  views: allConfigs.flatMap((cfg: any) => cfg.views || []),
  apps: allConfigs.flatMap((cfg: any) => cfg.apps || []),
  dashboards: allConfigs.flatMap((cfg: any) => cfg.dashboards || []),
  reports: allConfigs.flatMap((cfg: any) => cfg.reports || []),
  pages: allConfigs.flatMap((cfg: any) => cfg.pages || []),
} as any);

// Re-merge listViews and actions that defineStack stripped from objects
const mergedAppWithViews = {
  ...mergedApp,
  objects: mergeActionsIntoObjects(
    mergeViewsIntoObjects(mergedApp.objects || [], allConfigs),
    allConfigs,
  ),
};

// Export only plugins — no top-level objects/manifest/apps.
// The CLI auto-creates an AppPlugin from the config if it detects objects/manifest/apps,
// which would conflict with our explicit AppPlugin and skip seed data loading.
export default {
  plugins: [
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver()),
    new AppPlugin(mergedAppWithViews),
    new HonoServerPlugin({ port: 3000 }),
    new ConsolePlugin(),
  ],
};
