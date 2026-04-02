/**
 * Root Development Configuration
 *
 * Aggregates all example apps for `pnpm dev`.
 * Each example stack is loaded as an independent AppPlugin instance.
 */
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { SetupPlugin } from '@objectstack/plugin-setup';
import { ConsolePlugin } from '@object-ui/console';
import { createMemoryI18n } from '@objectstack/core';
import { mergeViewsIntoObjects } from '@object-ui/core';
import crmConfig from './examples/crm/objectstack.config';
import todoConfig from './examples/todo/objectstack.config';
import kitchenSinkConfig from './examples/kitchen-sink/objectstack.config';

/**
 * Adapter: prepare a stack config for AppPlugin.
 * - Merges stack-level views into object definitions
 * - Converts i18n translations to the spec format AppPlugin expects
 */
function prepareConfig(config: any) {
  const result = { ...config };
  if (result.objects && result.views) {
    result.objects = mergeViewsIntoObjects(result.objects, result.views);
  }
  // AppPlugin.loadTranslations() expects `translations: Array<{ [locale]: data }>`.
  // Stack configs have `i18n: { namespace, translations: { en: {...}, zh: {...} } }`.
  // Convert: wrap each locale's data under the namespace.
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

/**
 * Registers the in-memory i18n service during init (Phase 1)
 * so AppPlugin.start() → loadTranslations() (Phase 2) can find it.
 */
class MemoryI18nPlugin {
  readonly name = 'com.objectstack.service.i18n';
  readonly version = '1.0.0';
  readonly type = 'service' as const;

  init(ctx: any) {
    ctx.registerService('i18n', createMemoryI18n());
  }
}

export default {
  plugins: [
    new MemoryI18nPlugin(),
    // SetupPlugin first: registers setupNav during init for contributing plugins,
    // and registers the merged Setup app during start before ObjectQL scans.
    new SetupPlugin(),
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver()),
    // Each example stack loaded as an independent AppPlugin
    new AppPlugin(prepareConfig(crmConfig)),
    new AppPlugin(prepareConfig(todoConfig)),
    new AppPlugin(prepareConfig(kitchenSinkConfig)),
    // AuthPlugin after ObjectQL (needs 'data' service) and after SetupPlugin (uses setupNav)
    new AuthPlugin({
      secret: process.env.AUTH_SECRET || 'objectui-dev-secret',
      baseUrl: 'http://localhost:3000',
    }),
    new HonoServerPlugin({ port: 3000 }),
    new ConsolePlugin(),
  ],
};
