/**
 * The `organizations.*` PICKER family (avatar menu / console picker — distinct
 * from `organization.*` org MANAGEMENT, see the separating comment in `en.ts`)
 * must use one noun per pack, not two (objectui#5215).
 *
 * ## The defect this pins
 *
 * `en` and `zh` were renamed from "organization" to "workspace" terminology in
 * full. The other eight packs (`ar`, `de`, `es`, `fr`, `ja`, `ko`, `pt`, `ru`)
 * had only `create` follow, leaving every one of them mixing both nouns in a
 * single dropdown — `de.ts` read `create: "Workspace erstellen"` directly
 * beside `mine: "Meine Organisationen"`, two lines apart in the same menu.
 *
 * ## Why no existing gate sees this class
 *
 * `all-locales-key-parity` is a KEY-SET invariant — every pack has every key,
 * so it is green whether or not two keys in the same pack agree on a noun.
 * `check:i18n-drift` follows changes to the **en** VALUE; en has not moved, so
 * there is nothing to follow. `check:i18n-keys` compares call-site keys and
 * inline `defaultValue`s against **en** only — the eight non-en packs are
 * outside its comparison set. None of the three looks at same-language
 * vocabulary consistency, which is exactly the axis this defect lives on.
 *
 * ## What this test is, and is not
 *
 * This is NOT the general vocabulary-consistency gate the issue explicitly
 * declined to ask for — building one that works for arbitrary synonym pairs
 * across arbitrary namespaces is a different, harder card. This is a narrow,
 * cheap pin for the ONE family that was measured to have the defect: it
 * asserts that no `organizations.*` picker value, in any of the eight packs,
 * still contains that pack's OLD organization-noun. A future edit that
 * reintroduces the old noun in one key without updating its neighbors — the
 * exact shape of the original defect — fails here immediately.
 */
import { describe, it, expect } from 'vitest';
import { builtInLocales } from '../locales';

type LocaleCode = keyof typeof builtInLocales;

/** The keys that carry the picker's noun (objectui#5215's enumerated scope). */
const NOUN_KEYS = [
  'mine',
  'title',
  'heading',
  'subtitle',
  'searchPlaceholder',
  'new',
  'current',
  'emptyTitle',
  'emptyDescription',
  'noMatches',
] as const;

/**
 * The eight packs in scope, each with the OLD organization-noun stem(s) that
 * must no longer appear in any `NOUN_KEYS` value, and the pack's own
 * already-established workspace term (taken from `create`, unchanged by this
 * fix) that every `NOUN_KEYS` value must now contain instead.
 */
// Stems are deliberately SHORT — short enough to survive each pack's own
// pluralization/inflection of the noun (e.g. Arabic "مساحة" singular vs.
// "مساحات" plural share only the 4-letter root "مساح"; Spanish/French
// "espacio de trabajo" / "espace de travail" only add an -s to the FIRST
// word in the plural, so the shared, inflection-proof anchor is the
// invariant second word, "trabajo" / "travail"). All comparisons below are
// case-insensitive so pt's sentence-initial "Workspace atual" / "Workspaces"
// match the same lowercase stem as its mid-sentence "um workspace".
const PACKS: Record<string, { oldStems: string[]; newStem: string }> = {
  ar: { oldStems: ['مؤسس'], newStem: 'مساح' },
  de: { oldStems: ['organisation'], newStem: 'workspace' },
  es: { oldStems: ['organizaci'], newStem: 'trabajo' },
  fr: { oldStems: ['organisation'], newStem: 'travail' },
  ja: { oldStems: ['組織'], newStem: 'ワークスペース' },
  ko: { oldStems: ['조직'], newStem: '워크스페이스' },
  pt: { oldStems: ['organizaç'], newStem: 'workspace' },
  ru: { oldStems: ['организац'], newStem: 'пространств' },
};

const at = (pack: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], pack);

describe('objectui#5215 — organizations.* picker family speaks one noun per pack', () => {
  it('covers exactly the eight non-en/zh packs and all ten noun-carrying keys', () => {
    expect(Object.keys(PACKS).sort()).toEqual(['ar', 'de', 'es', 'fr', 'ja', 'ko', 'pt', 'ru']);
    expect(NOUN_KEYS).toHaveLength(10);
  });

  it.each(Object.keys(PACKS) as LocaleCode[])(
    '%s: no organizations.* picker value still carries the old organization-noun',
    (lang) => {
      const { oldStems } = PACKS[lang];
      for (const key of NOUN_KEYS) {
        const value = at(builtInLocales[lang], `organizations.${key}`);
        expect(typeof value, `organizations.${key} in ${lang}`).toBe('string');
        const lowered = (value as string).toLowerCase();
        for (const stem of oldStems) {
          expect(
            lowered.includes(stem.toLowerCase()),
            `organizations.${key} in ${lang} still contains "${stem}": ${JSON.stringify(value)}`,
          ).toBe(false);
        }
      }
    },
  );

  it.each(Object.keys(PACKS) as LocaleCode[])(
    '%s: every organizations.* picker value uses the pack\'s own workspace term',
    (lang) => {
      const { newStem } = PACKS[lang];
      for (const key of NOUN_KEYS) {
        const value = at(builtInLocales[lang], `organizations.${key}`) as string;
        expect(
          value.toLowerCase().includes(newStem.toLowerCase()),
          `organizations.${key} in ${lang} does not contain "${newStem}": ${JSON.stringify(value)}`,
        ).toBe(true);
      }
    },
  );

  it('the sibling organization.* (singular, management) namespace is untouched — still the org noun', () => {
    // Guards the namespace-separation premise this fix depends on: the picker
    // family renamed, the management family deliberately did not (comment
    // between the two blocks in en.ts). If a future change collapses that
    // separation this assertion is the first thing to notice.
    for (const lang of Object.keys(PACKS) as LocaleCode[]) {
      const { oldStems } = PACKS[lang];
      const backToList = at(builtInLocales[lang], 'organization.backToList');
      expect(typeof backToList, `organization.backToList in ${lang}`).toBe('string');
      const lowered = (backToList as string).toLowerCase();
      const containsOldStem = oldStems.some((stem) => lowered.includes(stem.toLowerCase()));
      expect(containsOldStem, `organization.backToList in ${lang}: ${JSON.stringify(backToList)}`).toBe(true);
    }
  });
});
