/**
 * Todo Example Plugin
 *
 * Exports the Todo configuration as an ObjectStack plugin that can be
 * loaded by any ObjectStack application. Other projects can import
 * the Todo metadata (objects, apps, dashboards, manifest) without
 * needing to know the internal structure.
 *
 * Usage in another project:
 *
 *   import { TodoPlugin } from '@object-ui/example-todo/plugin';
 *
 *   const kernel = new ObjectKernel();
 *   kernel.use(new TodoPlugin());
 *
 * Or import the raw config for merging:
 *
 *   import { todoConfig } from '@object-ui/example-todo/plugin';
 */

import type { AppPluginContext } from '@object-ui/types';
import config from './objectstack.config';

/** Raw Todo stack configuration for direct merging */
export const todoConfig = config;

/**
 * Todo Plugin — wraps the Todo metadata as a kernel-compatible plugin.
 *
 * When loaded via `kernel.use(new TodoPlugin())`, ObjectStack's AppPlugin
 * will register all Todo objects, apps, dashboards, and seed data.
 */
export class TodoPlugin {
  readonly name = '@object-ui/example-todo';
  readonly version = '1.0.0';
  readonly type = 'app-metadata' as const;
  readonly description = 'Task management metadata (objects, apps, dashboards, seed data)';

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
      logger.info('[Todo] Metadata loaded: objects, apps, dashboards, seed data');
    } catch (e: any) {
      logger.warn(`[Todo] Could not auto-register via AppPlugin: ${e.message}`);
      logger.info('[Todo] Config is available via todoConfig export for manual merging');
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

export default TodoPlugin;
