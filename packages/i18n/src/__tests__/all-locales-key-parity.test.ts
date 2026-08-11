/**
 * Full key parity across all ten locale packs (objectui#2872 P3).
 *
 * This replaces the four-namespace ratchet added in objectui#2905. That one was
 * deliberately scoped because the eight non-Chinese packs were still ~277 keys
 * behind, and a full assertion would have been a permanently red build rather
 * than a guard. With the backfill complete, the scope restriction is gone and
 * the invariant is simply: **every pack defines every `en` key, and no pack
 * defines a key `en` lacks.**
 *
 * Why this needs a test at all: `fallbackLng: 'en'` makes both failure modes
 * invisible at runtime.
 *
 *   - A key missing from `de` renders English. That reads as "not translated
 *     yet", not "we lost this" — and the missing-key handler is dev-only, so CI
 *     never sees it.
 *   - A key added to one pack but never to `en` cannot be translated by anyone
 *     else and drifts silently. objectui#2872 part (b) was exactly this, 74 keys
 *     deep, hidden behind a component-private fallback that made English
 *     "happen to" render.
 *
 * The only permitted exception is the outbound-message set below.
 *
 * ## What this test does NOT own
 *
 * Key sets and placeholder shape, and nothing about what a value SAYS. Two
 * sibling gates split the rest, and the boundaries are load-bearing:
 *
 *   - `scripts/check-i18n-call-site-keys.mjs` (objectui#3530) — a key a `t()`
 *     call site asks for that NO pack defines. Ten packs identically missing it
 *     is full parity, so this file is green on it by construction.
 *   - `scripts/check-i18n-en-drift.mjs` (objectui#3650) — when an `en` VALUE
 *     changes, the nine translations must change in the same PR. This file was
 *     green through objectui#3582 and objectui#3625, correctly: neither touched
 *     a key set or a placeholder. Trying to make it red on those would be asking
 *     a key-set test to judge meaning.
 *
 * That gate skips any key a pack does not define — including the four
 * `OUTBOUND_KEYS` below — precisely because their key sets are this file's
 * business, so the two cannot contradict each other on the same fact.
 *
 * ## The second invariant here: a plural family carries a base key (objectui#3863)
 *
 * Parity across packs is necessary and NOT sufficient, and `detail.showEmptyRelated`
 * was the proof: ten packs, identical key sets, `_one` and `_other` in every one of
 * them — full parity, green — and `ru` still rendered ENGLISH at counts 2-20 and `ar`
 * at 2-99. The mechanism is one level below key sets. i18next asks
 * `Intl.PluralRules` for the ONE suffix a language needs for that number and, when
 * the pack has no such slot, walks `fallbackLng` to `en`. `ru` has four categories
 * (`one/few/many/other`) and `ar` six (`+ zero/two`); no pack in this repo defines
 * `_few`/`_many`/`_two`/`_zero`, so those categories resolved nothing locally.
 *
 * Enumerating the missing slots per language is the fix that CANNOT be taken here:
 * giving `ru` a `_few` would be a key `en` lacks, which the parity assertions above
 * fail by design. The fix that composes with parity is the BASE key (no suffix) —
 * always in i18next's lookup chain, so every category a pack did not enumerate lands
 * on it, in the pack's own language, and the key set stays identical across ten packs.
 *
 * So this file owns the rule "a plural family must carry a base key" for a measured
 * reason rather than by convenience — the two candidate homes were compared:
 *
 *   - `scripts/check-i18n-call-site-keys.mjs` reads exactly ONE pack
 *     (`collectEnKeys`, `packages/i18n/src/locales/en.ts`). Slot coverage is a
 *     per-pack fact about `ru` and `ar`; an `en`-only instrument cannot state it, and
 *     it only sees families reached from a statically parsable `t()` literal — a
 *     family added to the packs before its call site lands (the objectui#3546
 *     transition, which ran for months) would be invisible. Tightening its
 *     `resolvesLeaf` would also make it report a complete-but-baseless family as
 *     `missing-key`, whose remediation text reads "The key exists in no locale pack" —
 *     false for a family nine packs define.
 *   - Here, the rule is pack-intrinsic: it walks all ten packs' own key sets, needs no
 *     call site to exist, and fails in `pnpm test` at PR time.
 */
import { describe, it, expect } from 'vitest';
import { builtInLocales } from '../locales';

/**
 * Text the console SENDS to the agent rather than displays. These are absent
 * from the eight non-gate packs ON PURPOSE: the console resolves them from the
 * `en`/`zh` packs by the CONVERSATION's language (objectui#3896), so a value in
 * any other pack is unreachable, and the cloud confirm gate only recognises
 * those two languages anyway — see `outbound-agent-messages.test.ts`, which owns
 * that invariant and asserts it in both directions. Excluded here so the two
 * guards cannot contradict each other.
 */
const OUTBOUND_KEYS = new Set([
  'console.ai.planApproveMessage',
  'console.ai.planApproveDefaultsMessage',
  'console.ai.planAnswerMessage',
  'console.ai.changesConfirmMessage',
]);

function keyPaths(node: unknown, prefix = ''): string[] {
  return node !== null && typeof node === 'object'
    ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
        keyPaths(v, prefix ? `${prefix}.${k}` : k),
      )
    : [prefix];
}

const keysOf = (pack: unknown) => new Set(keyPaths(pack).filter((k) => !OUTBOUND_KEYS.has(k)));

/**
 * `Object.keys` erases which keys it enumerated, so `builtInLocales[lang]` on a
 * plain `string` is an implicit-`any` index into a `const` map (TS7053) — the
 * suite would then be comparing packs the compiler never confirmed exist. The
 * assertion is derived from the map itself, so a locale added to (or removed
 * from) `builtInLocales` reaches these cases for free, while a typo'd code is a
 * compile error. Same convention as `authRemediation-locale-parity.test.ts` and
 * `inboxBadgeBreakdown-i18n-7233.test.ts` next door.
 */
type LocaleCode = keyof typeof builtInLocales;

const EN = keysOf(builtInLocales.en);
const OTHER_LOCALES = (Object.keys(builtInLocales) as LocaleCode[]).filter((l) => l !== 'en');

describe('all locale packs are at full key parity with en (objectui#2872)', () => {
  it('the comparison covers the whole pack — not an empty assertion', () => {
    // If a refactor breaks `keyPaths`, every diff below becomes trivially empty
    // and the suite would pass while asserting nothing.
    expect(EN.size).toBeGreaterThan(2000);
    expect(OTHER_LOCALES).toHaveLength(9);
  });

  it.each(OTHER_LOCALES)('%s defines every en key', (lang) => {
    // Build the pack's key set ONCE. Calling `keysOf` inside the predicate
    // re-walks the whole locale tree per `en` key (~2.5k keys x a full
    // recursive walk), which made this quadratic: ~850-2200ms per locale
    // isolated, and >15s — a timeout, not a parity failure — once full-suite
    // contention slowed each walk down. The sibling assertion below always
    // hoisted it; this one didn't.
    const packKeys = keysOf(builtInLocales[lang]);
    const missing = [...EN].filter((k) => !packKeys.has(k)).sort();
    expect(missing, `${lang} is missing ${missing.length} key(s)`).toEqual([]);
  });

  it.each(OTHER_LOCALES)('%s defines no key that en lacks', (lang) => {
    const extra = [...keysOf(builtInLocales[lang])].filter((k) => !EN.has(k)).sort();
    expect(extra, `${lang} has ${extra.length} key(s) absent from en`).toEqual([]);
  });

  it('placeholders match en in every pack', () => {
    // A translation that drops `{{count}}` renders a sentence with a hole in it
    // and no error. `gantt.quickFilter.resultSummary` uses SINGLE braces on
    // purpose — its call site does a literal `.replace('{shown}', …)` instead
    // of i18next interpolation — so both forms are compared.
    //
    // NOTE this comparison is RELATIVE (en vs pack) and cannot see the defect
    // in objectui#4157: every pack agreed with `en` on `{{count}}` while the
    // render call site still did `.replace('{count}', …)`, so the shapes
    // matched and this stayed green while the dialog showed a literal `{2}`.
    // The absolute pack-vs-call-site form is pinned in
    // `gantt-count-interpolation-4157.test.ts`.
    const DOUBLE = /\{\{\w+\}\}/g;
    const SINGLE = /(?<!\{)\{\w+\}(?!\})/g;
    const shape = (v: unknown) =>
      typeof v === 'string'
        ? [...(v.match(DOUBLE) ?? []), ...(v.match(SINGLE) ?? [])].sort().join(',')
        : null;
    const at = (pack: unknown, dotted: string) =>
      dotted.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown>)?.[p], pack);

    const mismatches: string[] = [];
    for (const lang of OTHER_LOCALES) {
      for (const key of EN) {
        const a = shape(at(builtInLocales.en, key));
        const b = shape(at(builtInLocales[lang], key));
        if (a !== null && b !== null && a !== b) {
          mismatches.push(`${lang} ${key}: en[${a}] vs ${lang}[${b}]`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

/**
 * i18next's plural suffixes, CLDR order. Deliberately the same list as
 * `scripts/check-i18n-call-site-keys.mjs`'s `PLURAL_SUFFIXES`, and asserted equal to
 * `Intl.PluralRules`' own vocabulary below so the two cannot drift apart silently.
 */
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'] as const;

const ALL_LOCALES = Object.keys(builtInLocales) as LocaleCode[];

/** Every leaf path of a pack — no `OUTBOUND_KEYS` subtraction: a base key must be a
 *  real leaf of the SAME pack, whatever the parity exemptions are. */
const leavesOf = (pack: unknown) => new Set(keyPaths(pack));

/**
 * The plural families of one pack: base path → the suffixes it defines.
 * A leaf whose name merely ends in one of the suffixes IS a family member — that is
 * exactly how i18next reads it, so a key accidentally named `foo_one` is a real
 * defect here and not a false positive.
 */
function familiesOf(pack: unknown): Map<string, string[]> {
  const families = new Map<string, string[]>();
  for (const path of leavesOf(pack)) {
    const suffix = PLURAL_SUFFIXES.find((s) => path.endsWith(s) && path.length > s.length);
    if (suffix === undefined) continue;
    const base = path.slice(0, -suffix.length);
    families.set(base, [...(families.get(base) ?? []), suffix]);
  }
  return families;
}

describe('every plural family carries a base key (objectui#3863)', () => {
  it('the walk finds the families it is meant to judge — not an empty assertion', () => {
    // Without this, deleting every plural family (or breaking `familiesOf`) would
    // make the rule below trivially green. The count is `en`'s and parity carries it
    // to the other nine; it is a floor, not a pin, so a new family does not have to
    // edit this line — only a family DISAPPEARING has to be explained.
    expect(familiesOf(builtInLocales.en).size).toBeGreaterThanOrEqual(5);
    expect(ALL_LOCALES).toHaveLength(10);
    // The suffix list is i18next's, which takes it from `Intl.PluralRules`. Compared
    // as sets against the union of all ten packs' languages so a CLDR category this
    // repo can actually meet cannot be missing from the list above.
    const categories = new Set(
      ALL_LOCALES.flatMap((l) => new Intl.PluralRules(l).resolvedOptions().pluralCategories),
    );
    expect([...categories].map((c) => `_${c}`).sort()).toEqual([...PLURAL_SUFFIXES].sort());
  });

  it.each(ALL_LOCALES)('%s defines the base key of every plural family it has', (lang) => {
    // THE rule. i18next resolves `key_<category>` for the one category the number
    // needs; the base key is the only slot that answers for every category the pack
    // did not spell out, and it answers IN THIS PACK instead of falling through
    // `fallbackLng` to English. A family without it leaks English at exactly the
    // counts its language meets first (objectui#3863: `ru` 2-20, `ar` 2-99).
    const leaves = leavesOf(builtInLocales[lang]);
    const baseless = [...familiesOf(builtInLocales[lang])]
      .filter(([base]) => !leaves.has(base))
      .map(([base, suffixes]) => `${base} [${suffixes.sort().join(',')}] has no base key`)
      .sort();
    expect(baseless, `${lang}: ${baseless.length} plural family/families with no base key`).toEqual(
      [],
    );
  });

  it('the rule bites — five of the ten packs have categories that only a base key can serve', () => {
    // Why the rule is not cosmetic, stated as data rather than prose. `en`/`de` and
    // `zh`/`ja`/`ko` genuinely cannot reach the base key (their whole category set is
    // covered by `_one`/`_other`), so for them it is parity ballast; for the other
    // six it is the slot a real user hits.
    const reachable = ALL_LOCALES.filter((l) =>
      new Intl.PluralRules(l)
        .resolvedOptions()
        .pluralCategories.some((c) => c !== 'one' && c !== 'other'),
    );
    expect(reachable.sort()).toEqual(['ar', 'es', 'fr', 'pt', 'ru']);
    // …and `ru`/`ar` reach it at everyday counts, which is what makes this a
    // user-visible defect rather than a theoretical one: `fr`/`es`/`pt` only use
    // `many` from a million up.
    expect(new Intl.PluralRules('ru').select(3)).toBe('few');
    expect(new Intl.PluralRules('ru').select(7)).toBe('many');
    expect(new Intl.PluralRules('ar').select(2)).toBe('two');
    expect(new Intl.PluralRules('ar').select(30)).toBe('many');
    expect(new Intl.PluralRules('fr').select(100)).toBe('other');
    expect(new Intl.PluralRules('fr').select(1_000_000)).toBe('many');
  });
});
