// Copyright (c) 2025 ObjectUI. Licensed under the MIT license.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// @ts-ignore
globalThis.require = require;

import { defineStack } from '@objectstack/spec';
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { SetupPlugin } from '@objectstack/plugin-setup';
import { ConsolePlugin } from '@object-ui/console';
// @ts-ignore
import * as CorePkg from '@objectstack/core';

const createMemoryI18n = CorePkg.createMemoryI18n || (CorePkg as any).default?.createMemoryI18n;

// Import example apps
// @ts-ignore
import crmConfigImport from '@object-ui/example-crm/objectstack.config';
// @ts-ignore
import todoConfigImport from '@object-ui/example-todo/objectstack.config';
// @ts-ignore
import kitchenSinkConfigImport from '@object-ui/example-kitchen-sink/objectstack.config';

/** Resolve ESM default-export interop */
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

const crmConfig = prepareConfig(resolveDefault(crmConfigImport));
const todoConfig = prepareConfig(resolveDefault(todoConfigImport));
const kitchenSinkConfig = prepareConfig(resolveDefault(kitchenSinkConfigImport));

const appConfigs = [crmConfig, todoConfig, kitchenSinkConfig];

/**
 * Lightweight plugin that registers the in-memory i18n service during the
 * init phase. This is critical for server mode because:
 *
 *   1. AppPlugin.start() → loadTranslations() needs an i18n service.
 *   2. The kernel's own memory i18n fallback is auto-registered in
 *      validateSystemRequirements() — which runs AFTER all plugin starts.
 *   3. Without an early-registered i18n service, loadTranslations() finds
 *      nothing and silently skips — translations never get loaded.
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

/**
 * Shared authentication plugin — reads secrets from environment variables
 * so the same config works both locally and on Vercel (where VERCEL_URL is injected).
 */
const authPlugin = new AuthPlugin({
  secret: process.env.AUTH_SECRET ?? 'dev-secret-please-change-in-production-min-32-chars',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'),
});

/**
 * Plugin ordering matters:
 *
 * - MemoryI18nPlugin MUST come before AppPlugin so that the i18n service
 *   exists when AppPlugin.start() → loadTranslations() runs.
 * - SetupPlugin MUST load before AuthPlugin so that the setupNav service
 *   is registered and available when AuthPlugin.init() tries to contribute menu items.
 */
const plugins: any[] = [
  new MemoryI18nPlugin(),
  new ObjectQLPlugin(),
  new DriverPlugin(new InMemoryDriver(), 'memory'),
  // Each example app loaded as an independent AppPlugin
  ...appConfigs.map((config: any) => new AppPlugin(config)),
  // SetupPlugin must come before AuthPlugin (setupNav service dependency)
  new SetupPlugin(),
  // AuthPlugin contributes to setupNav during init, so it must come AFTER SetupPlugin
  authPlugin,
  // Console UI plugin - serves the frontend SPA
  new ConsolePlugin(),
];

export default defineStack({
  manifest: {
    id: 'com.objectui.server',
    namespace: 'server',
    name: 'ObjectUI Server',
    version: '3.3.0',
    description: 'Production server with Console UI and example apps (CRM, Todo, Kitchen Sink)',
    type: 'app',
  },

  // Explicitly Load Plugins and Apps
  plugins,

  build: {
    outDir: './dist',
    sourcemap: true,
    minify: true,
    target: 'node18',
  },

  datasources: {
    default: {
      driver: 'memory',
      config: {},
    },
  },

  dev: {
    port: 3000,
    host: '0.0.0.0',
    watch: true,
    hotReload: true,
  },

  deploy: {
    target: 'serverless',
    region: 'us-east-1',
  },
});
