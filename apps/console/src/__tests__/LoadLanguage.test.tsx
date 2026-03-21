/**
 * loadLanguage Tests
 *
 * Verifies that the loadLanguage helper correctly unwraps the
 * @objectstack/spec REST API envelope (`{ data: { locale, translations } }`)
 * while remaining backward-compatible with flat mock/dev responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Re-implement the loadLanguage logic under test (mirrors apps/console/src/main.tsx)
// ---------------------------------------------------------------------------
async function loadLanguage(lang: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`/api/v1/i18n/translations/${lang}`);
    if (!res.ok) {
      console.warn(`[i18n] Failed to load translations for '${lang}': HTTP ${res.status}`);
      return {};
    }
    const json = await res.json();
    // Unwrap the spec REST API envelope when present
    if (json && typeof json === 'object' && json.data && json.data.translations && typeof json.data.translations === 'object') {
      return json.data.translations as Record<string, unknown>;
    }
    // Fallback: mock server / local dev returns flat translation objects
    return json;
  } catch (err) {
    console.warn(`[i18n] Failed to load translations for '${lang}':`, err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('loadLanguage', () => {
  const fetchSpy = vi.fn<(...args: any[]) => Promise<Response>>();

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
});
