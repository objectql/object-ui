/**
 * `loadLocales` — reading the app's locale list off `GET /api/v1/i18n/locales`
 * (objectui#4039).
 *
 * The endpoint answers with locale *descriptors*, not bare codes, and the
 * descriptor's `label` is the code echoed back (`toLocaleDescriptors` in
 * @objectstack/spec sets `label: code`). Both facts are pinned here: the parse
 * reads `code`, and nothing downstream is tempted to treat `label` as a display
 * name.
 *
 * Every failure path returns `[]` — the provider reads that as "I don't know"
 * and falls back to the built-in packs, so a language menu can never take the
 * console down.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadLocales } from './loadLocales';

function respond(json: unknown, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, status, json: async () => json })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadLocales', () => {
  it('reads codes out of the spec REST envelope', async () => {
    respond({
      data: {
        locales: [
          { code: 'en', label: 'en', isDefault: true },
          { code: 'zh', label: 'zh', isDefault: false },
          { code: 'th', label: 'th', isDefault: false },
        ],
      },
    });

    await expect(loadLocales()).resolves.toEqual(['en', 'zh', 'th']);
  });

  it('accepts the un-enveloped body a mock server may return', async () => {
    respond({ locales: [{ code: 'en' }, { code: 'pt-BR' }] });

    await expect(loadLocales()).resolves.toEqual(['en', 'pt-BR']);
  });

  it('tolerates a bare string array from an older mock', async () => {
    respond(['en', 'ja']);

    await expect(loadLocales()).resolves.toEqual(['en', 'ja']);
  });

  it('drops entries with no usable code, and de-duplicates', async () => {
    respond({ data: { locales: [{ code: 'en' }, { label: 'no code' }, { code: '' }, { code: 'en' }] } });

    await expect(loadLocales()).resolves.toEqual(['en']);
  });

  it('returns [] on a non-OK response', async () => {
    respond({}, false, 503);

    await expect(loadLocales()).resolves.toEqual([]);
  });

  it('returns [] when there is no backend at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));

    await expect(loadLocales()).resolves.toEqual([]);
  });

  it('returns [] on a payload that is not a list', async () => {
    respond({ data: { locales: 'en,zh' } });

    await expect(loadLocales()).resolves.toEqual([]);
  });
});
