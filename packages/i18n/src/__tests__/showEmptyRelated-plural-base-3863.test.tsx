/**
 * `detail.showEmptyRelated` renders in the user's own language at EVERY plural
 * category — objectui#3863, the base-key fix, asserted through the real i18next.
 *
 * ## What was broken
 *
 * This was the repo's only pre-existing i18next plural family, and all ten packs
 * defined exactly two slots: `_one` and `_other`. i18next asks `Intl.PluralRules`
 * for the ONE suffix a language needs for that number and, finding no such slot,
 * walks `fallbackLng` to `en` — so the button rendered ENGLISH at:
 *
 *   - `ru` counts 2-4 (`few`) and 5-20, 25-30, … (`many`)
 *   - `ar` counts 0 (`zero`), 2 (`two`), 3-10 (`few`), 11-99 (`many`)
 *
 * The call site is the collapsed-empties button in
 * `packages/plugin-detail/src/renderers/record-reference-rail.tsx`, whose count is
 * `emptyTitles.length` — so 2 to 4 are the *most common* values it ever takes, and a
 * Russian user essentially always saw English.
 *
 * ## Why the fix is a base key and not `_few`/`_many`
 *
 * `all-locales-key-parity.test.ts` requires the ten packs to hold IDENTICAL key sets,
 * so giving `ru` a `_few` would be "a key `en` lacks" and fails by design. The base
 * key (no suffix) is always in i18next's lookup chain, so every category a pack did
 * not enumerate lands on it — in that pack's language — while the key set stays
 * identical everywhere. Established by objectui#3546 slice six for `perm.facet.*`
 * (`perm-home-namespace-3546.test.tsx`, the template this file follows); that slice
 * filed this family rather than fixing it, and this is that debt.
 *
 * The rule itself ("a plural family must carry a base key") lives in
 * `all-locales-key-parity.test.ts` — pack-intrinsic, so the NEXT plural family fails
 * at PR time without needing a call site to exist. This file pins the rendering.
 *
 * ## Why these assertions are the ones that discriminate
 *
 * `en` output is identical before and after (its categories are exactly `one`/`other`,
 * so it never reaches the base key), and so is `de`/`zh`/`ja`/`ko` output. Every
 * assertion that can tell the fix from its absence is a `ru` or `ar` one — the rest
 * prove reachability and prove the English wording did not move.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { I18nProvider, useObjectTranslation } from '../provider';
import { builtInLocales } from '../locales/index';

const KEY = 'detail.showEmptyRelated';
const SLOTS = [KEY, `${KEY}_one`, `${KEY}_other`] as const;

/** Derived from the map, not `string[]`: `Object.keys` erases which keys it
 *  enumerated, making `builtInLocales[lang]` an implicit-`any` index (TS7053). */
type LocaleCode = keyof typeof builtInLocales;
const LANGS = Object.keys(builtInLocales) as LocaleCode[];

/** The counts the card measured, plus 0 and 21 — `ru` 21 is `one` (not `other`),
 *  which is the trap a "1 is singular, everything else is plural" model falls into. */
const COUNTS = [0, 1, 2, 3, 5, 11, 21, 100] as const;

const CALL_SITE = 'packages/plugin-detail/src/renderers/record-reference-rail.tsx';
const DEFAULTS = 'packages/plugin-detail/src/useDetailTranslation.ts';

const at = (pack: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], pack);

const wrapperFor = (lang: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <I18nProvider config={{ defaultLanguage: lang, detectBrowserLanguage: false }}>
        {children}
      </I18nProvider>
    );
  };

/** Read a source file and prove the read landed, or assertions on it are vacuous.
 *  `import.meta.url` is not a file: URL in the dom project, so resolve from the
 *  vitest root — which the invocation guard pins to the repo root. */
function sourceOf(rel: string): string {
  const path = join(process.cwd(), rel);
  expect(existsSync(path), `source not found at ${path}`).toBe(true);
  return readFileSync(path, 'utf8');
}

beforeEach(() => {
  // The provider persists the last language (objectstack#5406); without this a stale
  // locale leaks into the next case.
  window.localStorage.clear();
});

describe('objectui#3863 — detail.showEmptyRelated carries a base key in all ten packs', () => {
  it('covers ten packs and three slots — guards the loops from emptying', () => {
    expect(LANGS).toHaveLength(10);
    expect(SLOTS).toHaveLength(3);
    expect(COUNTS.length).toBeGreaterThanOrEqual(7);
  });

  it.each(LANGS)('%s defines all three slots as non-empty strings', (lang) => {
    for (const slot of SLOTS) {
      const value = at(builtInLocales[lang], slot);
      expect(typeof value, `${lang}.${slot}`).toBe('string');
      expect((value as string).trim().length, `${lang}.${slot} is empty`).toBeGreaterThan(0);
    }
  });

  it('every slot in every pack interpolates exactly {{count}}', () => {
    // A translation that drops the hole renders a button with no number in it; one
    // that invents a second hole renders braces verbatim. Two regexes on purpose — a
    // /g regex is stateful and reusing it for `.test()` skips every other match.
    const HOLES = /\{\{\w+\}\}/g;
    for (const lang of LANGS) {
      for (const slot of SLOTS) {
        const holes = ((at(builtInLocales[lang], slot) as string).match(HOLES) ?? []).join(',');
        expect(holes, `${lang}.${slot}`).toBe('{{count}}');
      }
    }
  });

  it('the premise: the call site still asks for this key with a count', () => {
    // Everything below describes what that button renders. If it stopped passing
    // `count`, or moved to another key, these assertions would be about nothing.
    const src = sourceOf(CALL_SITE);
    expect(src).toContain("t('detail.showEmptyRelated', {");
    expect(src).toContain("defaultValue: '+ {{count}} empty',");
    expect(src).toContain('count: emptyTitles.length,');
  });

  describe('through the real i18next — provider mounted', () => {
    it.each(LANGS)('%s stays in its own language at every plural category', (lang) => {
      // THE assertion. `Intl.PluralRules` is the same resolver i18next uses, so
      // `select()` predicts which slot must answer: a category the pack enumerates
      // takes its suffixed slot, everything else falls to the base key. Computing the
      // expectation from the pack (rather than hard-coding strings) is what makes this
      // fail loudly if a pack's WORDING moves without its slots moving.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
      const rules = new Intl.PluralRules(lang);
      const enumerated = new Set(['one', 'other']);
      for (const count of COUNTS) {
        const category = rules.select(count);
        const slot = enumerated.has(category) ? `${KEY}_${category}` : KEY;
        const expected = (at(builtInLocales[lang], slot) as string).replace(
          '{{count}}',
          String(count),
        );
        expect(result.current.t(KEY, { count }), `${lang} at count=${count} (${category})`).toBe(
          expected,
        );
      }
    });

    it('ru renders Russian at few and many — the counts this button takes most often', () => {
      // Named rather than left to the loop above, because these are the exact values
      // the card measured rendering English, and the numbers are the point.
      expect(new Intl.PluralRules('ru').select(2)).toBe('few');
      expect(new Intl.PluralRules('ru').select(3)).toBe('few');
      expect(new Intl.PluralRules('ru').select(7)).toBe('many');
      expect(new Intl.PluralRules('ru').select(11)).toBe('many');
      // 21 is `one` in Russian — the base key must NOT swallow it.
      expect(new Intl.PluralRules('ru').select(21)).toBe('one');

      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('ru') });
      const { t } = result.current;
      expect(t(KEY, { count: 3 })).toBe('+ Пустых: 3');
      expect(t(KEY, { count: 7 })).toBe('+ Пустых: 7');
      expect(t(KEY, { count: 11 })).toBe('+ Пустых: 11');
      expect(t(KEY, { count: 1 })).toBe('+ 1 пустое');
      expect(t(KEY, { count: 21 })).toBe('+ 21 пустое');
      // …and NOT the English the fallback chain produced before the base key existed.
      expect(t(KEY, { count: 3 })).not.toBe('+ 3 empty');
      for (const count of COUNTS) {
        expect(t(KEY, { count }), `ru leaked English at ${count}`).not.toContain('empty');
      }
    });

    it('ar renders Arabic at zero, two, few and many', () => {
      expect(new Intl.PluralRules('ar').select(0)).toBe('zero');
      expect(new Intl.PluralRules('ar').select(2)).toBe('two');
      expect(new Intl.PluralRules('ar').select(5)).toBe('few');
      expect(new Intl.PluralRules('ar').select(30)).toBe('many');
      // 100 is `other` in Arabic and was already correct before the fix — kept so a
      // regression that breaks the enumerated slots is visible too.
      expect(new Intl.PluralRules('ar').select(100)).toBe('other');

      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('ar') });
      const { t } = result.current;
      expect(t(KEY, { count: 2 })).toBe('+ 2 فارغ(فارغة)');
      expect(t(KEY, { count: 5 })).toBe('+ 5 فارغ(فارغة)');
      expect(t(KEY, { count: 30 })).toBe('+ 30 فارغ(فارغة)');
      expect(t(KEY, { count: 1 })).toBe('+ 1 فارغ');
      expect(t(KEY, { count: 100 })).toBe('+ 100 فارغة');
      for (const count of COUNTS) {
        expect(t(KEY, { count }), `ar leaked English at ${count}`).not.toContain('empty');
      }
    });

    it('no pack leaks the English string at any count', () => {
      // The aggregate form of the defect, stated once over the whole matrix: "empty"
      // may appear ONLY in the pack that owns that word. Before the base key this was
      // false for 5 of the 8 ru counts and 5 of the 8 ar counts.
      const leaks: string[] = [];
      for (const lang of LANGS.filter((l) => l !== 'en')) {
        window.localStorage.clear();
        const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
        for (const count of COUNTS) {
          const value = result.current.t(KEY, { count });
          if (value === `+ ${count} empty`) leaks.push(`${lang} @ ${count}: ${value}`);
        }
      }
      expect(leaks).toEqual([]);
    });

    it('en is byte-for-byte unchanged — this fix must not move any English copy', () => {
      // The other half of a translation fix: the language that was already correct has
      // to stay correct, at every count and through every slot.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('en') });
      for (const count of COUNTS) {
        expect(result.current.t(KEY, { count }), `en at count=${count}`).toBe(`+ ${count} empty`);
      }
      for (const slot of SLOTS) {
        expect(at(builtInLocales.en, slot), `en.${slot}`).toBe('+ {{count}} empty');
      }
    });

    it('the packs that cannot reach the base key still render their own language', () => {
      // de/zh/ja/ko have no category outside `one`/`other`, so their base key is
      // ballast. Pinned anyway: a "fix" that accidentally routed everything through the
      // base key would be invisible in ru/ar (where base and _other agree in meaning)
      // and visible here only if someone asserts it.
      const CASES: Array<[LocaleCode, number, string]> = [
        ['de', 1, '+ 1 leer'],
        ['de', 7, '+ 7 leer'],
        ['zh', 3, '+ 3 个为空'],
        ['ja', 3, '+ 3 件（空）'],
        ['ko', 3, '+ 3개 비어 있음'],
        ['fr', 1, '+ 1 vide'],
        ['fr', 7, '+ 7 vides'],
        ['es', 7, '+ 7 vacíos'],
        ['pt', 7, '+ 7 vazios'],
      ];
      for (const [lang, count, expected] of CASES) {
        window.localStorage.clear();
        const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
        expect(result.current.t(KEY, { count }), `${lang} at ${count}`).toBe(expected);
      }
    });

    it('fr, es and pt reach their base key only from a million up', () => {
      // Their third category is `many`, and CLDR starts it at 1e6 — so their base key
      // is real but practically unreachable, which is why it repeats `_other` instead
      // of restructuring the way ru and ar had to.
      for (const lang of ['fr', 'es', 'pt'] as const) {
        expect(new Intl.PluralRules(lang).select(100)).toBe('other');
        expect(new Intl.PluralRules(lang).select(1_000_000)).toBe('many');
        window.localStorage.clear();
        const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
        // Whichever slot answers, it is this pack's own words — never English.
        expect(result.current.t(KEY, { count: 1_000_000 }), `${lang} at 1e6`).toBe(
          (at(builtInLocales[lang], KEY) as string).replace('{{count}}', '1000000'),
        );
      }
    });
  });

  describe('the provider-less path — the same key through the defaults table', () => {
    it("fallbackT resolves the base key literally, which is why the table needed one", () => {
      // `createSafeTranslation`'s `fallbackT` reads `defaults[key] || key` and never
      // appends a plural suffix, so the two suffixed rows are unreachable through it:
      // before this fix the provider-less path answered with the RAW KEY. Pinned
      // against the source so a refactor that teaches `fallbackT` plural resolution
      // has to come past this comment.
      const defaults = sourceOf(DEFAULTS);
      expect(defaults).toContain("'detail.showEmptyRelated': '+ {{count}} empty',");
      expect(defaults).toContain("'detail.showEmptyRelated_one': '+ {{count}} empty',");
      const helper = sourceOf('packages/i18n/src/useSafeTranslation.ts');
      expect(helper).toContain('let value = defaults[key] || key;');
    });
  });

  it('the base key is what parity now requires of every plural family', () => {
    // The cross-reference that keeps this fix from being undone in isolation: the rule
    // lives next door, and it is stated over ALL families, not just this one.
    const parity = sourceOf('packages/i18n/src/__tests__/all-locales-key-parity.test.ts');
    expect(parity).toContain('every plural family carries a base key (objectui#3863)');
    expect(parity).toContain('defines the base key of every plural family it has');
  });
});
