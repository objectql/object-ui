/**
 * i18n Translations Pipeline Tests
 *
 * Validates that the i18n translation pipeline delivers CRM translations
 * correctly through all code paths:
 *  - Kernel service: getTranslations returns flat dict (not wrapped)
 *  - HttpDispatcher: wraps into standard spec envelope
 *  - MSW handler: returns correct { data: { locale, translations } }
 *
 * Regression test for empty translations:{} response.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { createKernel, type KernelResult } from '../mocks/createKernel';
import { createAuthHandlers } from '../mocks/authHandlers';
import { appConfigs, setupAppConfig } from '../../objectstack.shared';
import { crmLocales } from '@object-ui/example-crm';

// Expected values from the CRM i18n bundles — avoid hard-coding in assertions
const EXPECTED_ZH_ACCOUNT_LABEL = crmLocales.zh.objects.account.label;
const EXPECTED_EN_ACCOUNT_LABEL = crmLocales.en.objects.account.label;

describe('i18n translations pipeline', () => {
  let result: KernelResult;
  let server: ReturnType<typeof setupServer>;

  beforeAll(async () => {
    result = await createKernel({
      appConfigs: [...appConfigs, setupAppConfig],
      persistence: false,
      mswOptions: {
        enableBrowser: false,
        baseUrl: '/api/v1',
        logRequests: false,
        customHandlers: [
          ...createAuthHandlers('/api/v1/auth'),
        ],
      },
    });

    const handlers = result.mswPlugin?.getHandlers() ?? [];
    server = setupServer(...handlers);
    server.listen({ onUnhandledRequest: 'bypass' });
  });

  afterAll(() => {
    server?.close();
  });

  // ── Kernel service layer ───────────────────────────────────────────

  it('kernel i18n service returns flat translations dict (not wrapped)', () => {
    const i18nService = result.kernel.getService('i18n') as any;
    const translations = i18nService.getTranslations('zh');

    // Must NOT have the { locale, translations } wrapper
    expect(translations).not.toHaveProperty('locale');
    expect(translations).toHaveProperty('crm');
    expect(translations.crm.objects.account.label).toBe(EXPECTED_ZH_ACCOUNT_LABEL);
  });

  it('kernel i18n service returns English translations', () => {
    const i18nService = result.kernel.getService('i18n') as any;
    const translations = i18nService.getTranslations('en');

    expect(translations.crm.objects.account.label).toBe(EXPECTED_EN_ACCOUNT_LABEL);
  });

  it('kernel i18n service returns empty for unknown locale', () => {
    const i18nService = result.kernel.getService('i18n') as any;
    const translations = i18nService.getTranslations('xx');

    expect(Object.keys(translations)).toHaveLength(0);
  });

  // ── HttpDispatcher layer ───────────────────────────────────────────

  it('HttpDispatcher returns populated translations in spec envelope', async () => {
    const { HttpDispatcher } = await import('@objectstack/runtime');
    const dispatcher = new HttpDispatcher(result.kernel);

    const dispatchResult = await dispatcher.handleI18n('/translations/zh', 'GET', {}, {} as any);

    expect(dispatchResult.handled).toBe(true);
    expect(dispatchResult.response?.status).toBe(200);
    const body = dispatchResult.response?.body;
    expect(body?.success).toBe(true);
    expect(body?.data?.locale).toBe('zh');
    expect(Object.keys(body?.data?.translations ?? {}).length).toBeGreaterThan(0);
    expect(body?.data?.translations?.crm?.objects?.account?.label).toBe(EXPECTED_ZH_ACCOUNT_LABEL);
  });

  // ── MSW handler layer (fetch) ──────────────────────────────────────

  it('GET /api/v1/i18n/translations/zh returns CRM zh translations', async () => {
    const res = await fetch('http://localhost/api/v1/i18n/translations/zh');
    expect(res.ok).toBe(true);

    const json = await res.json();
    const translations = json?.data?.translations;

    expect(translations).toBeDefined();
    expect(Object.keys(translations).length).toBeGreaterThan(0);
    expect(translations.crm).toBeDefined();
    expect(translations.crm.objects.account.label).toBe(EXPECTED_ZH_ACCOUNT_LABEL);
  });

  it('GET /api/v1/i18n/translations/en returns CRM en translations', async () => {
    const res = await fetch('http://localhost/api/v1/i18n/translations/en');
    const json = await res.json();

    expect(json?.data?.translations?.crm?.objects?.account?.label).toBe(EXPECTED_EN_ACCOUNT_LABEL);
  });

  // ── Server-mode compatibility (AppPlugin.loadTranslations) ────────

  it('kernel i18n service supports loadTranslations (AppPlugin compat)', () => {
    const i18nService = result.kernel.getService('i18n') as any;

    // AppPlugin.loadTranslations calls these methods; they must exist
    expect(typeof i18nService.loadTranslations).toBe('function');
    expect(typeof i18nService.getLocales).toBe('function');
    expect(typeof i18nService.getDefaultLocale).toBe('function');
    expect(typeof i18nService.setDefaultLocale).toBe('function');
  });

  it('kernel i18n service getLocales returns all CRM locales', () => {
    const i18nService = result.kernel.getService('i18n') as any;
    const locales = i18nService.getLocales();

    // CRM declares 10 locales: en, zh, ja, ko, de, fr, es, pt, ru, ar
    expect(locales).toContain('en');
    expect(locales).toContain('zh');
    expect(locales.length).toBeGreaterThanOrEqual(10);
  });

  it('appConfig.translations is spec-format array for AppPlugin', () => {
    const translations = (appConfigs[0] as any).translations;

    expect(Array.isArray(translations)).toBe(true);
    expect(translations.length).toBeGreaterThan(0);

    // Each entry maps locale → namespace-scoped data
    const first = translations[0];
    expect(first).toHaveProperty('zh');
    expect(first).toHaveProperty('en');
    // Data must be nested under namespace (e.g. 'crm')
    expect(first.zh).toHaveProperty('crm');
    expect(first.zh.crm.objects.account.label).toBe(EXPECTED_ZH_ACCOUNT_LABEL);
    expect(first.en.crm.objects.account.label).toBe(EXPECTED_EN_ACCOUNT_LABEL);
  });

  // ── Server-mode flow simulation ───────────────────────────────────
  // Simulates the exact flow that `pnpm start` (CLI serve) uses:
  // 1. createMemoryI18n() registers the i18n service
  // 2. AppPlugin.loadTranslations() iterates config.translations
  // 3. HttpDispatcher.handleI18n() calls getTranslations(locale)

  it('server-mode: memory i18n + AppPlugin loadTranslations produces populated response', async () => {
    // Import the same createMemoryI18n used by the MemoryI18nPlugin in objectstack.config.ts
    const { createMemoryI18n } = await import('@objectstack/core');
    const svc = createMemoryI18n();

    // Simulate AppPlugin.loadTranslations() iterating the spec-format translations array
    const translations = (appConfigs[0] as any).translations;
    for (const bundle of translations) {
      for (const [locale, data] of Object.entries(bundle)) {
        if (data && typeof data === 'object') {
          svc.loadTranslations(locale, data as Record<string, unknown>);
        }
      }
    }

    // After loading, getTranslations must return populated CRM data
    const zh = svc.getTranslations('zh') as any;
    expect(zh).toHaveProperty('crm');
    expect(zh.crm.objects.account.label).toBe(EXPECTED_ZH_ACCOUNT_LABEL);

    const en = svc.getTranslations('en') as any;
    expect(en).toHaveProperty('crm');
    expect(en.crm.objects.account.label).toBe(EXPECTED_EN_ACCOUNT_LABEL);

    // getLocales must list all loaded languages
    const locales = svc.getLocales();
    expect(locales).toContain('en');
    expect(locales).toContain('zh');
    expect(locales.length).toBeGreaterThanOrEqual(10);
  });
});