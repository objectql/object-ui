/**
 * `fields.textarea.characterCount` exists in all ten packs, interpolating BOTH
 * `{{count}}` and `{{max}}` (objectui#3406).
 *
 * `all-locales-key-parity` already enforces en↔pack key parity and placeholder
 * *shape* parity generically, so this file is deliberately narrow: it pins the
 * three things that guard cannot express on its own.
 *
 *  1. The key exists in `en` at all. Full parity is symmetric — deleting the
 *     block from *every* pack keeps that suite green while the textarea
 *     counter silently reverts to its code default for every locale.
 *  2. The ABSOLUTE placeholder form. Shape parity stays consistent if someone
 *     respells all ten at once; a sentence that lost `{{max}}` everywhere would
 *     pass there and announce half the fact here.
 *  3. That the eight non-`en`, non-`zh` packs were actually TRANSLATED rather
 *     than backfilled with the English sentence. This key was born in all ten
 *     at once, which is exactly the moment a copy-paste backfill is cheapest —
 *     and a copied English string is invisible at runtime, because the whole
 *     defect being fixed is English reaching a non-English screen reader.
 */
import { describe, it, expect } from 'vitest';
import { builtInLocales } from '../locales';

const LANGS = Object.keys(builtInLocales);

const characterCountOf = (lang: string) =>
  (builtInLocales[lang] as any)?.fields?.textarea?.characterCount as string | undefined;

describe('fields.textarea.characterCount locale coverage (objectui#3406)', () => {
  it('covers all ten built-in packs', () => {
    expect(LANGS).toHaveLength(10);
  });

  it.each(LANGS)('%s defines the counter sentence as a non-empty string', (lang) => {
    const value = characterCountOf(lang);
    expect(typeof value, `${lang} has no fields.textarea.characterCount`).toBe('string');
    expect(value!.trim().length, `${lang}.fields.textarea.characterCount is empty`).toBeGreaterThan(0);
  });

  it.each(LANGS)('%s interpolates both the count and the cap', (lang) => {
    // Absolute form, not shape-relative. A pack that announces the count and
    // drops the cap reads as a complete sentence and is wrong.
    const value = characterCountOf(lang)!;
    expect(value, `${lang} drops {{count}}`).toContain('{{count}}');
    expect(value, `${lang} drops {{max}}`).toContain('{{max}}');
  });

  it('the English pack is byte-identical to the literal it replaced', () => {
    // The widget rendered `Character count: ${n} of ${max}` before
    // objectui#3406. This value and `FIELD_DEFAULTS['fields.textarea.characterCount']`
    // in `packages/fields` must both still say exactly that, so neither an `en`
    // session nor a provider-less embed changed. The fields-side half of this
    // pin lives in `TextAreaField.characterCount.no-provider.test.tsx` —
    // `packages/i18n` cannot import `packages/fields`, the dependency runs the
    // other way.
    expect(characterCountOf('en')).toBe('Character count: {{count}} of {{max}}');
  });

  it('no other pack serves the English sentence verbatim', () => {
    // The defect this key exists to fix IS English copy reaching a non-English
    // session; a backfill that pasted `en` into the other nine would reproduce
    // it while satisfying every parity guard in the repo.
    const untranslated = LANGS.filter(
      (l) => l !== 'en' && characterCountOf(l)!.includes('Character count'),
    );
    expect(untranslated).toEqual([]);
  });
});
