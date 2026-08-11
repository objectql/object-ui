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
