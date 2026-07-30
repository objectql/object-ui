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
 */
import { describe, it, expect } from 'vitest';
import { builtInLocales } from '../locales';

/**
 * Text the console SENDS to the agent rather than displays. These are absent
 * from the eight non-gate packs ON PURPOSE, so `t()` falls through to its
 * English default and the cloud confirm gate keeps recognising the message —
 * see `outbound-agent-messages.test.ts`, which owns that invariant and asserts
 * it in both directions. Excluded here so the two guards cannot contradict
 * each other.
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

const EN = keysOf(builtInLocales.en);
const OTHER_LOCALES = Object.keys(builtInLocales).filter((l) => l !== 'en');

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
    // and no error. Two gantt keys use SINGLE braces on purpose — their call
    // site does a literal `.replace('{count}', …)` instead of i18next
    // interpolation — so both forms are compared.
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
