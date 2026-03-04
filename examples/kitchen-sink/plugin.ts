/**
 * Kitchen Sink Example Plugin
 *
 * Exports the Kitchen Sink configuration as an ObjectStack plugin that can be
 * loaded by any ObjectStack application. Other projects can import
 * the Kitchen Sink metadata (objects, apps, dashboards, manifest) without
 * needing to know the internal structure.
 *
 * Usage in another project:
 *
 *   import { KitchenSinkPlugin } from '@object-ui/example-kitchen-sink/plugin';
 *
 *   const kernel = new ObjectKernel();
 *   kernel.use(new KitchenSinkPlugin());
 *
 * Or import the raw config for merging:
 *
 *   import { kitchenSinkConfig } from '@object-ui/example-kitchen-sink/plugin';
 */

import type { AppPluginContext } from '@object-ui/types';
import config from './objectstack.config';

/** Raw Kitchen Sink stack configuration for direct merging */
export const kitchenSinkConfig = config;

/**
 * Kitchen Sink Plugin — wraps the Kitchen Sink metadata as a kernel-compatible plugin.
 *
 * When loaded via `kernel.use(new KitchenSinkPlugin())`, ObjectStack's AppPlugin
 * will register all Kitchen Sink objects, apps, dashboards, and seed data.
 */
export class KitchenSinkPlugin {
  readonly name = '@object-ui/example-kitchen-sink';
  readonly version = '1.0.0';
  readonly type = 'app-metadata' as const;
  readonly description = 'Kitchen Sink showcase metadata (all field types, views, and UI capabilities)';

  async init() {
    // No initialization needed
  }

  async start(ctx: AppPluginContext) {
    const logger = ctx.logger || console;

    try {
      // Dynamically import AppPlugin to keep plugin.ts dependency-light
      const { AppPlugin } = await import('@objectstack/runtime');
      const appPlugin = new AppPlugin(config);
      await ctx.kernel?.use?.(appPlugin);
      logger.info('[KitchenSink] Metadata loaded: objects, apps, dashboards, seed data');
    } catch (e: any) {
      logger.warn(`[KitchenSink] Could not auto-register via AppPlugin: ${e.message}`);
      logger.info('[KitchenSink] Config is available via kitchenSinkConfig export for manual merging');
    }
  }

  async stop() {
    // Teardown: no persistent resources to release
  }

  /** Raw stack configuration for legacy/manual merging */
  getConfig() {
    return config;
  }
}

export default KitchenSinkPlugin;
