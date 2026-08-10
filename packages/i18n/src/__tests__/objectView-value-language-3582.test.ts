/**
 * `console.objectView.systemViewReadonly` / `.expandToPage` hold real
 * translations in all ten packs — not English (objectui#3582).
 *
 * This is a different defect class from objectui#3546's ledger. There the key
 * was MISSING from a pack; here the key was PRESENT in all ten and eight of
 * them stored the English string as their "translation". Every existing gate
 * compares key *sets* or placeholder *shape*, so all of them stayed green:
 *
 *   - `all-locales-key-parity` — key sets are identical, and neither key
 *     interpolates anything, so its placeholder check has nothing to compare.
 *     It is green before AND after this fix, by construction; that is exactly
 *     why it could not see the bug.
 *   - `scripts/check-i18n-call-site-keys.mjs` and its baseline ratchet — both
 *     ask whether the key exists in `en`. It does. These two keys were never
 *     in the ratchet.
 *
 * `systemViewReadonly` carried the sharper half: the eight packs did not hold
 * `en`'s current sentence, they held a STALE one `en` itself had already
 * abandoned — "duplicate to customize", a workflow the product no longer
 * offers. So eight locales were not merely untranslated, they described a
 * path that does not exist. The `en` pin below is the guard against a repeat:
 * change `en`'s copy again and this file goes red, which forces the eight to
 * be revisited in the same PR instead of drifting for another release.
 */
import { describe, it, expect } from 'vitest';
import { builtInLocales } from '../locales';

const LANGS = Object.keys(builtInLocales);

const objectViewOf = (lang: string) =>
  (builtInLocales[lang] as any)?.console?.objectView as Record<string, string>;

const readonlyOf = (lang: string) => objectViewOf(lang)?.systemViewReadonly;
const expandOf = (lang: string) => objectViewOf(lang)?.expandToPage;

/**
 * Both English spellings that must not survive outside `en`: the CURRENT `en`
 * copy, and the STALE sentence the eight packs stored before objectui#3582.
 * Checking only the current one would let the original defect back in
 * verbatim.
 */
const EN_CURRENT = {
  systemViewReadonly: 'System view defined in code — read-only.',
  expandToPage: 'Open as full page',
} as const;
const EN_STALE_READONLY = 'System view defined in code - duplicate to customize.';

/**
 * Script ranges for the packs where "is this value in the pack's language?" is
 * mechanically decidable. de/fr/es/pt share the Latin alphabet with `en`, so
 * they get the equality checks below instead — there is no clean positive
 * criterion for them, which is the reason objectui#3582 recorded a repo-wide
 * ASCII gate as a SEPARATE, non-acceptance item rather than folding it in here.
 */
const NATIVE_SCRIPT: Record<string, RegExp> = {
  zh: /\p{Script=Han}/u,
  ja: /\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Han}/u,
  ko: /\p{Script=Hangul}/u,
  ru: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u,
};

describe('console.objectView value-language coverage (objectui#3582)', () => {
  it('covers all ten built-in packs', () => {
    expect(LANGS).toHaveLength(10);
  });

  it.each(LANGS)('%s defines both keys as non-empty strings', (lang) => {
    for (const key of ['systemViewReadonly', 'expandToPage'] as const) {
      const value = objectViewOf(lang)?.[key];
      expect(typeof value, `${lang}.console.objectView.${key}`).toBe('string');
      expect(value!.trim().length, `${lang}.console.objectView.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it('the en pack still says read-only, not "duplicate to customize"', () => {
    // The semantic the other nine were translated against. If this literal
    // changes, the nine translations below are stale by definition — that is
    // the failure this pin exists to make loud, and it is precisely what went
    // unnoticed when `en` was last reworded.
    expect(readonlyOf('en')).toBe(EN_CURRENT.systemViewReadonly);
    expect(expandOf('en')).toBe(EN_CURRENT.expandToPage);
  });

  it('no pack but en serves either English spelling of systemViewReadonly', () => {
    const english = LANGS.filter(
      (l) =>
        l !== 'en' &&
        (readonlyOf(l) === EN_CURRENT.systemViewReadonly || readonlyOf(l) === EN_STALE_READONLY),
    );
    expect(english, `packs serving English: ${english.join(', ')}`).toEqual([]);
  });

  it('no pack but en serves the English spelling of expandToPage', () => {
    const english = LANGS.filter((l) => l !== 'en' && expandOf(l) === EN_CURRENT.expandToPage);
    expect(english, `packs serving English: ${english.join(', ')}`).toEqual([]);
  });

  it('the retired "duplicate to customize" workflow is named by no pack', () => {
    // Scoped to these two keys on purpose. The same stale claim still lives in
    // `view.readonlyTooltip`, TRANSLATED into all eight languages — objectui#3625.
    // Widening this regex to the whole pack would red on that one, which is a
    // separate fix; and note no equality-with-English or ASCII heuristic can
    // see it, because those eight values ARE idiomatic translations. They just
    // translate a sentence `en` retired.
    const leaked = LANGS.filter((l) => /duplicate to customi[sz]e/i.test(readonlyOf(l)!));
    expect(leaked).toEqual([]);
  });

  it.each(Object.keys(NATIVE_SCRIPT))('%s writes both values in its own script', (lang) => {
    const re = NATIVE_SCRIPT[lang];
    expect(re.test(readonlyOf(lang)!), `${lang} systemViewReadonly has no native script`).toBe(true);
    expect(re.test(expandOf(lang)!), `${lang} expandToPage has no native script`).toBe(true);
  });

  it('all ten packs differ from one another on both keys', () => {
    // The tightest statement of "nobody pasted one language into another".
    // These two sentences are legitimately distinct in all ten today; a future
    // translation that genuinely collides is a reason to relax this line with
    // a note, not to widen it silently.
    for (const [key, read] of [
      ['systemViewReadonly', readonlyOf],
      ['expandToPage', expandOf],
    ] as const) {
      const values = LANGS.map(read);
      expect(new Set(values).size, `${key} has duplicate values across packs`).toBe(LANGS.length);
    }
  });

  it('expandToPage matches its own pack detail.openAsFullPage, in every pack', () => {
    // `detail.openAsFullPage` is the SAME English sentence in a neighbouring
    // namespace ("Open as full page"), and it was already translated in all
    // ten while `console.objectView.expandToPage` was not. en and zh already
    // held the two byte-identical to each other; this keeps the eight that way
    // too, so the icon button and the expand affordance cannot drift into two
    // different words for one action in a single locale.
    for (const lang of LANGS) {
      expect(expandOf(lang), `${lang} expandToPage vs detail.openAsFullPage`).toBe(
        (builtInLocales[lang] as any).detail.openAsFullPage,
      );
    }
  });
});
