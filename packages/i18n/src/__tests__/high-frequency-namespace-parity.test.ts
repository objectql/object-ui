/**
 * Ratchet for the namespaces backfilled in objectui#2872 part (a).
 *
 * `console`, `home`, `topbar` and `layout` were translated into all ten packs
 * (objectui#2903) because they carry the AI console, the home screen, the top
 * bar and the system navigation — the surfaces a non-English admin cannot avoid.
 *
 * `fallbackLng: 'en'` makes a regression here invisible: drop a key from `de`
 * and the UI renders English, which looks like "not translated yet" rather than
 * "we lost this". Nothing errors, and the dev-only missing-key handler never
 * fires in CI. So the backfill needs a ratchet or it quietly erodes.
 *
 * Scope is deliberately these four namespaces and no more. The rest of the
 * packs are still ~277 keys behind (`grid` 101, `gantt` 58, `dashboard` 25 and
 * a long tail) and stay tracked under objectui#2872 — asserting full parity
 * today would just be a red CI with no action attached to it. Widen this list
 * as each namespace is completed; do not widen it ahead of the translations.
 */
import { describe, it, expect } from 'vitest';
import { builtInLocales } from '../locales';

/**
 * The four keys the console SENDS to the agent rather than displays. They are
 * intentionally absent from the eight non-gate packs so `t()` falls through to
 * its English default — see `outbound-agent-messages.test.ts` for the full
 * reasoning. Excluded here so the two guards do not contradict each other.
 */
const OUTBOUND_KEYS = new Set([
  'console.ai.planApproveMessage',
  'console.ai.planApproveDefaultsMessage',
  'console.ai.planAnswerMessage',
  'console.ai.changesConfirmMessage',
]);

const RATCHETED_NAMESPACES = ['console', 'home', 'topbar', 'layout'] as const;

function keyPaths(node: unknown, prefix = ''): string[] {
  return node !== null && typeof node === 'object'
    ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
        keyPaths(v, prefix ? `${prefix}.${k}` : k),
      )
    : [prefix];
}

function ratchetedKeys(pack: unknown): Set<string> {
  return new Set(
    RATCHETED_NAMESPACES.flatMap((ns) =>
      keyPaths((pack as Record<string, unknown>)[ns], ns),
    ).filter((k) => !OUTBOUND_KEYS.has(k)),
  );
}

const EN = ratchetedKeys(builtInLocales.en);
const OTHER_LOCALES = Object.keys(builtInLocales).filter((l) => l !== 'en');

describe('high-frequency namespaces stay at parity with en (objectui#2872 part a)', () => {
  it('the ratchet covers a substantial key set — not an empty assertion', () => {
    // Guards against the whole file silently becoming a no-op if a namespace
    // is renamed and `keyPaths` starts returning nothing.
    expect(EN.size).toBeGreaterThan(300);
    for (const ns of RATCHETED_NAMESPACES) {
      expect([...EN].some((k) => k.startsWith(`${ns}.`)), `${ns} contributed no keys`).toBe(
        true,
      );
    }
  });

  it.each(OTHER_LOCALES)('%s defines every ratcheted en key', (lang) => {
    const missing = [...EN].filter((k) => !ratchetedKeys(builtInLocales[lang]).has(k)).sort();
    expect(
      missing,
      `${lang} is missing ${missing.length} key(s) from the backfilled namespaces`,
    ).toEqual([]);
  });

  it.each(OTHER_LOCALES)('%s defines no ratcheted key that en lacks', (lang) => {
    // The other direction: a key added to one pack but never to `en` cannot be
    // translated by anyone else and will drift. objectui#2872 part (b) was
    // exactly this, 74 keys deep, hidden behind a component-private fallback.
    const extra = [...ratchetedKeys(builtInLocales[lang])].filter((k) => !EN.has(k)).sort();
    expect(extra, `${lang} has ${extra.length} key(s) absent from en`).toEqual([]);
  });
});
