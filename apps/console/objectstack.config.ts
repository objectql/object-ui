
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// @ts-ignore
globalThis.require = require;

import { sharedConfig } from './objectstack.shared';

// @ts-ignore
import * as MSWPluginPkg from '@objectstack/plugin-msw';
// @ts-ignore
import * as ObjectQLPluginPkg from '@objectstack/objectql';
// @ts-ignore
import * as HonoServerPluginPkg from '@objectstack/plugin-hono-server';
// @ts-ignore
import * as DriverMemoryPkg from '@objectstack/driver-memory';
// @ts-ignore
import * as RuntimePkg from '@objectstack/runtime';
// @ts-ignore
import * as CorePkg from '@objectstack/core';

const MSWPlugin = MSWPluginPkg.MSWPlugin || (MSWPluginPkg as any).default?.MSWPlugin || (MSWPluginPkg as any).default;
const ObjectQLPlugin = ObjectQLPluginPkg.ObjectQLPlugin || (ObjectQLPluginPkg as any).default?.ObjectQLPlugin || (ObjectQLPluginPkg as any).default;
const InMemoryDriver = DriverMemoryPkg.InMemoryDriver || (DriverMemoryPkg as any).default?.InMemoryDriver || (DriverMemoryPkg as any).default;
const DriverPlugin = RuntimePkg.DriverPlugin || (RuntimePkg as any).default?.DriverPlugin || (RuntimePkg as any).default;
const HonoServerPlugin = HonoServerPluginPkg.HonoServerPlugin || (HonoServerPluginPkg as any).default?.HonoServerPlugin || (HonoServerPluginPkg as any).default;
const createMemoryI18n = CorePkg.createMemoryI18n || (CorePkg as any).default?.createMemoryI18n;

import { ConsolePlugin } from './plugin';

/**
 * Lightweight plugin that registers the in-memory i18n service during the
 * init phase.  This is critical for server mode (`pnpm start`) because:
 *
 *   1. The CLI auto-registers AppPlugin(config) before config plugins.
 *   2. During bootstrap, all plugin inits run first, then all starts.
 *   3. AppPlugin.start() → loadTranslations() needs the i18n service.
 *   4. The kernel's own memory fallback is registered in
 *      validateSystemRequirements() which runs AFTER all starts — too late.
 *
 * By providing the service during init, AppPlugin.start() finds it and
 * loads the spec-format `translations` array from the config.
 *
 * Name matches the check in CLI's serve command so it won't attempt to
 * duplicate-register I18nServicePlugin from @objectstack/service-i18n.
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

const plugins: any[] = [
    new MemoryI18nPlugin(),
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver(), 'memory'),
    new HonoServerPlugin({ port: 3000 }),
    new ConsolePlugin(),
];

// Re-enable MSW only if explicitly needed
if (process.env.ENABLE_MSW_PLUGIN === 'true') {
    plugins.push(new MSWPlugin());
}

export default {
  ...sharedConfig,
  
  build: {
    outDir: './dist',
    sourcemap: true,
    minify: true,
    target: 'node18',
  },
  
  datasources: {
    default: {
      driver: 'memory', 
    },
  },
  
  plugins,
  
  dev: {
    port: 3000,
    host: '0.0.0.0',
    watch: true,
    hotReload: true,
  },
  
  deploy: {
    target: 'static',
    region: 'us-east-1',
  },
};
