/**
 * ConsoleSetupNavPlugin
 *
 * Contributes console-specific navigation items to the Setup App,
 * pointing at the rich custom pages under `/apps/setup/system/*`
 * (e.g. Object Manager with the tabbed detail page, Applications
 * management, Dashboards / Pages / Reports metadata managers).
 *
 * Loads AFTER @objectstack/plugin-setup so the `setupNav` service
 * is available. Loads AFTER framework plugins (auth/security/audit)
 * that contribute their own object-driven items; this plugin only
 * adds items those plugins don't cover.
 *
 * @module mocks/ConsoleSetupNavPlugin
 */

import type { Plugin, PluginContext } from '@objectstack/core';

interface SetupNavContribution {
  areaId: string;
  items: Array<Record<string, unknown>>;
}

interface SetupNavService {
  contribute(c: SetupNavContribution): void;
}

export class ConsoleSetupNavPlugin implements Plugin {
  name = 'com.objectstack.console.setup-nav';
  type = 'standard';
  version = '1.0.0';
  dependencies = ['com.objectstack.setup'];

  async init(ctx: PluginContext): Promise<void> {
    const setupNav = ctx.getService<SetupNavService>('setupNav');
    if (!setupNav) {
      ctx.logger.warn('setupNav service not found — ConsoleSetupNavPlugin skipped');
      return;
    }

    // Platform area — metadata management pages unique to the console.
    setupNav.contribute({
      areaId: 'area_platform',
      items: [
        {
          id: 'nav_object_manager',
          type: 'url',
          label: 'Object Manager',
          href: '/apps/setup/system/metadata/object',
          icon: 'database',
          order: 5,
        },
        {
          id: 'nav_applications',
          type: 'url',
          label: 'Applications',
          href: '/apps/setup/system/apps',
          icon: 'layout-grid',
          order: 10,
        },
        {
          id: 'nav_dashboards',
          type: 'url',
          label: 'Dashboards',
          href: '/apps/setup/system/metadata/dashboard',
          icon: 'layout-dashboard',
          order: 20,
        },
        {
          id: 'nav_pages',
          type: 'url',
          label: 'Pages',
          href: '/apps/setup/system/metadata/page',
          icon: 'file-text',
          order: 30,
        },
        {
          id: 'nav_reports',
          type: 'url',
          label: 'Reports',
          href: '/apps/setup/system/metadata/report',
          icon: 'bar-chart-3',
          order: 40,
        },
      ],
    });

    // Administration area — profile link (user/org/role come from framework plugins).
    setupNav.contribute({
      areaId: 'area_administration',
      items: [
        {
          id: 'nav_profile',
          type: 'url',
          label: 'Profile',
          href: '/apps/setup/system/profile',
          icon: 'user',
          order: 100,
        },
      ],
    });

    ctx.logger.info('Console setup navigation items contributed');
  }
}
