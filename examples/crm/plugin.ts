/**
 * CRM Example Plugin
 *
 * Exports the CRM configuration as an ObjectStack plugin that can be
 * loaded by any ObjectStack application. Other projects can import
 * the CRM metadata (objects, apps, dashboards, manifest) without
 * needing to know the internal structure.
 *
 * Usage in another project:
 *
 *   import { CRMPlugin } from '@object-ui/example-crm/plugin';
 *
 *   const kernel = new ObjectKernel();
 *   kernel.use(new CRMPlugin());
 *
 * Or import the raw config for merging:
 *
 *   import { crmConfig } from '@object-ui/example-crm/plugin';
 */

import config from './objectstack.config';

/** Raw CRM stack configuration for direct merging */
export const crmConfig = config;

/**
 * CRM Plugin — wraps the CRM metadata as a kernel-compatible plugin.
 *
 * When loaded via `kernel.use(new CRMPlugin())`, ObjectStack's AppPlugin
 * will register all CRM objects, apps, dashboards, and seed data.
 */
export class CRMPlugin {
  readonly name = '@object-ui/example-crm';
  readonly version = '1.0.0';
  readonly type = 'app-metadata' as const;
  readonly description = 'CRM application metadata (objects, apps, dashboards, seed data)';

  async init() {
    // No initialization needed
  }

  async start(ctx: any) {
    const logger = ctx.logger || console;

    try {
      // Dynamically import AppPlugin to keep plugin.ts dependency-light
      const { AppPlugin } = await import('@objectstack/runtime');
      const appPlugin = new AppPlugin(config);
      await ctx.kernel?.use?.(appPlugin);
      logger.info('[CRM] Metadata loaded: objects, apps, dashboards, seed data');
    } catch (e: any) {
      logger.warn(`[CRM] Could not auto-register via AppPlugin: ${e.message}`);
      logger.info('[CRM] Config is available via crmConfig export for manual merging');
    }
  }
}

export default CRMPlugin;
