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
 */
import { defineStack } from '@objectstack/spec';
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
import { ConsolePlugin } from '@object-ui/console';
import CrmConfig from './examples/crm/objectstack.config';
import TodoConfig from './examples/todo/objectstack.config';
import KitchenSinkConfig from './examples/kitchen-sink/objectstack.config';

const crm = (CrmConfig as any).default || CrmConfig;
const todo = (TodoConfig as any).default || TodoConfig;
const kitchenSink = (KitchenSinkConfig as any).default || KitchenSinkConfig;

// Base objects from built-in examples
const baseObjects = [
  ...(crm.objects || []),
  ...(todo.objects || []),
  ...(kitchenSink.objects || []),
];

// Merge all example configs into a single app bundle for AppPlugin
const mergedApp = defineStack({
  manifest: {
    id: 'dev-workspace',
    name: 'dev_workspace',
    version: '0.0.0',
    description: 'ObjectUI monorepo development workspace',
    type: 'app',
    data: [
      ...(crm.manifest?.data || []),
      ...(todo.manifest?.data || []),
      ...(kitchenSink.manifest?.data || []),
    ],
  },
  objects: baseObjects,
  apps: [
    ...(crm.apps || []),
    ...(todo.apps || []),
    ...(kitchenSink.apps || []),
  ],
  dashboards: [
    ...(crm.dashboards || []),
    ...(todo.dashboards || []),
    ...(kitchenSink.dashboards || []),
  ],
  reports: [
    ...(crm.reports || []),
  ],
  pages: [
    ...(crm.pages || []),
    ...(todo.pages || []),
    ...(kitchenSink.pages || []),
  ],
} as any);

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
