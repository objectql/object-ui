/**
 * ObjectStack I18n Plugin
 *
 * Registers an i18n service on the ObjectStack kernel so that
 * the HTTP dispatcher (HonoServerPlugin / MSWPlugin) can serve
 * translation endpoints via the standard service mechanism.
 *
 * Without this plugin, the i18n API returns 404/501 because the
 * kernel has no 'i18n' service registered.
 *
 * ## Usage
 *
 * ```ts
 * import { I18nPlugin } from './i18nPlugin';
 *
 * export default {
 *   plugins: [
 *     new HonoServerPlugin({ port: 3000 }),
 *     new I18nPlugin(),
 *   ],
 * };
 * ```
 *
 * The plugin loads application-specific locale bundles from installed
 * example packages by default.  Pass a custom `loadLocale` function
 * to override the data source (e.g. load from a database or remote
 * service).
 *
 * @see https://github.com/objectstack-ai/objectui
 */

export interface I18nPluginOptions {
  /**
   * Custom locale loader.  When omitted the plugin falls back to the
   * default `loadAppLocale` implementation that imports from installed
   * example packages (e.g. @object-ui/example-crm).
   */
  loadLocale?: (lang: string) => Promise<Record<string, unknown>>;
}

/**
 * Default locale loader — dynamically imports translation bundles from
 * the installed example packages.
 */
async function defaultLoadLocale(lang: string): Promise<Record<string, unknown>> {
  try {
    const { crmLocales } = await import('@object-ui/example-crm');
    const translations = (crmLocales as Record<string, any>)[lang];
    if (!translations) return {};
    return { crm: translations };
  } catch {
    return {};
  }
}

export class I18nPlugin {
  readonly name = '@object-ui/i18n-plugin';
  readonly version = '1.0.0';
  readonly description = 'Registers i18n translation service on the ObjectStack kernel';

  private readonly loadLocale: (lang: string) => Promise<Record<string, unknown>>;

  constructor(options: I18nPluginOptions = {}) {
    this.loadLocale = options.loadLocale ?? defaultLoadLocale;
  }

  /**
   * Called by `kernel.use()` — no-op; the real work happens in `start`.
   */
  init() {
    // nothing to do
  }

  /**
   * Called during `kernel.bootstrap()`.
   *
   * Registers the i18n service so that the kernel's HTTP dispatcher
   * (HonoServerPlugin or MSWPlugin) can route `/api/v1/i18n/*`
   * requests to this service.
   */
  async start(ctx: any) {
    const kernel = ctx?.kernel ?? ctx;
    if (typeof kernel?.registerService === 'function') {
      const loader = this.loadLocale;
      kernel.registerService('i18n', {
        getTranslations: (lang: string) => loader(lang),
      });
    }
  }
}

export default I18nPlugin;
