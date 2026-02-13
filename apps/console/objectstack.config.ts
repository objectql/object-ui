
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

const MSWPlugin = MSWPluginPkg.MSWPlugin || (MSWPluginPkg as any).default?.MSWPlugin || (MSWPluginPkg as any).default;
const ObjectQLPlugin = ObjectQLPluginPkg.ObjectQLPlugin || (ObjectQLPluginPkg as any).default?.ObjectQLPlugin || (ObjectQLPluginPkg as any).default;
const InMemoryDriver = DriverMemoryPkg.InMemoryDriver || (DriverMemoryPkg as any).default?.InMemoryDriver || (DriverMemoryPkg as any).default;
const DriverPlugin = RuntimePkg.DriverPlugin || (RuntimePkg as any).default?.DriverPlugin || (RuntimePkg as any).default;
const HonoServerPlugin = HonoServerPluginPkg.HonoServerPlugin || (HonoServerPluginPkg as any).default?.HonoServerPlugin || (HonoServerPluginPkg as any).default;

import ConsolePlugin from './plugin';

const plugins: any[] = [
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver(), 'memory'),
    new HonoServerPlugin({ port: 3000 }),
    ConsolePlugin,
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
