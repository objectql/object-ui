/**
 * loadLanguage Tests
 *
 * Verifies that the loadLanguage helper correctly unwraps the
 * @objectstack/spec REST API envelope (`{ data: { locale, translations } }`)
 * while remaining backward-compatible with flat mock/dev responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadLanguage } from '../loadLanguage';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('loadLanguage', () => {
  const fetchSpy = vi.fn<(...args: Parameters<typeof fetch>) => Promise<Response>>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps spec REST API envelope { data: { locale, translations } }', async () => {
    const translations = { crm: { contact: '联系人', account: '客户' } };
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { locale: 'zh-CN', translations } }),
    } as Response);

    const result = await loadLanguage('zh-CN');
    expect(result).toEqual(translations);
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/i18n/translations/zh-CN');
  });

  it('returns flat JSON when mock/dev server returns without envelope', async () => {
    const flat = { crm: { contact: 'Contact', account: 'Account' } };
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => flat,
    } as Response);

    const result = await loadLanguage('en');
    expect(result).toEqual(flat);
  });

  it('returns empty object on HTTP error', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 404 } as Response);

    const result = await loadLanguage('xx');
    expect(result).toEqual({});
  });

  it('returns empty object on network failure', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await loadLanguage('en');
    expect(result).toEqual({});
  });

  it('handles envelope with null translations gracefully (fallback)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { locale: 'en', translations: null } }),
    } as Response);

    const result = await loadLanguage('en');
    // translations is null (not an object), so fallback to full JSON
    expect(result).toEqual({ data: { locale: 'en', translations: null } });
  });

  it('handles envelope with missing data field (fallback)', async () => {
    const flat = { hello: 'world' };
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => flat,
    } as Response);

    const result = await loadLanguage('en');
    expect(result).toEqual(flat);
  });

  it('auto-transforms TranslationData format (objects with nested fields)', async () => {
    // Simulate @objectstack/spec TranslationData format returned by I18nServicePlugin
    const specData = {
      objects: {
        account: {
          label: 'Account',
          pluralLabel: 'Accounts',
          fields: {
            name: { label: 'Account Name' },
            industry: { label: 'Industry', options: { Technology: 'Technology', Finance: 'Finance' } },
          },
        },
        contact: {
          label: 'Contact',
          fields: {
            email: { label: 'Email' },
          },
        },
      },
      apps: { crm: { label: 'CRM' } },
      messages: { 'common.save': 'Save' },
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { locale: 'en', translations: specData } }),
    } as Response);

    const result = await loadLanguage('en');

    // Should be wrapped under 'app' namespace with flat fields
    expect(result).toEqual({
      app: {
        objects: {
          account: { label: 'Account', pluralLabel: 'Accounts' },
          contact: { label: 'Contact' },
        },
        fields: {
          account: { name: 'Account Name', industry: 'Industry' },
          contact: { email: 'Email' },
        },
        fieldOptions: {
          account: { industry: { Technology: 'Technology', Finance: 'Finance' } },
        },
        apps: { crm: { label: 'CRM' } },
        messages: { 'common.save': 'Save' },
      },
    });
  });

  it('does NOT transform data that is already in namespace-wrapped format', async () => {
    // Already-transformed data (from objectstack.shared.ts or CRM example)
    const alreadyFlat = {
      crm: {
        objects: { account: { label: 'Account' } },
        fields: { account: { name: 'Account Name' } },
      },
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { locale: 'en', translations: alreadyFlat } }),
    } as Response);

    const result = await loadLanguage('en');
    // Should pass through unchanged
    expect(result).toEqual(alreadyFlat);
  });
});
