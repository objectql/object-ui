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
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
import type { MSWPluginOptions } from '@objectstack/plugin-msw';

export interface KernelOptions {
  /** Application configuration (defineStack output) */
  appConfig: any;
  /** Whether to skip system validation (useful in browser) */
  skipSystemValidation?: boolean;
  /** MSWPlugin options; when provided, MSWPlugin is added to the kernel. */
  mswOptions?: MSWPluginOptions;
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

      throw new Error(`[BrokerShim] Unhandled action: ${action}`);
    },
  };
}

/**
 * Sync `_id` with `id` on all records in the InMemoryDriver.
 *
 * The ObjectQL protocol uses `_id` for record identity lookups
 * (e.g. `filter: { _id: id }`), but InMemoryDriver stores the
 * generated identity as `id`. Seed data may also carry its own
 * `_id` that differs from the driver-assigned `id`.
 *
 * This helper ensures every record has `_id === id` so that
 * protocol lookups via `_id` match the driver-assigned `id`.
 */
function syncDriverIds(driver: InMemoryDriver): void {
  const db = (driver as any).db as Record<string, any[]>;
  for (const records of Object.values(db)) {
    for (const record of records) {
      if (record.id) {
        record._id = record.id;
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
 * Create and bootstrap an ObjectStack kernel with in-memory driver.
 *
 * This is the single factory used by both browser.ts and server.ts
 * so that kernel setup logic is not duplicated.
 */
export async function createKernel(options: KernelOptions): Promise<KernelResult> {
  const { appConfig, skipSystemValidation = true, mswOptions } = options;

  const driver = new InMemoryDriver();

  const kernel = new ObjectKernel({
    skipSystemValidation
  });

  await kernel.use(new ObjectQLPlugin());
  await kernel.use(new DriverPlugin(driver, 'memory'));
  await kernel.use(new AppPlugin(appConfig));

  let mswPlugin: MSWPlugin | undefined;
  if (mswOptions) {
    // Install a protocol-based broker shim BEFORE MSWPlugin's start phase
    // so that HttpDispatcher (inside MSWPlugin) can resolve data/metadata
    // calls without requiring a full Moleculer broker.
    await installBrokerShim(kernel);

    mswPlugin = new MSWPlugin(mswOptions);
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

  return { kernel, driver, mswPlugin };
}
