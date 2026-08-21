/**
 * objectui#5522 — `.env.production` must not commit a third-party telemetry
 * endpoint.
 *
 * Why a test and not just a code review note: `@object-ui/console` publishes a
 * PRE-BUILT SPA (`files: ["dist"]`, `prepublishOnly: pnpm build`). ONE
 * artifact, built once from this file, is what the hosted SaaS console AND the
 * on-premises / air-gapped EE images all embed. Vite inlines every `VITE_*`
 * defined here into that bundle as a frozen object literal, so a DSN committed
 * here is a live telemetry endpoint compiled into the artifact that lands
 * inside customer networks — and it cannot be switched off afterwards, because
 * the `VITE_SENTRY_ENABLED` kill switch is read off that same frozen literal
 * and is `undefined` forever on a build that never defined it.
 *
 * That is not hypothetical: an air-gapped EE deployment was measured sending
 * 14 Sentry envelopes per session to sentry.io carrying IP + User-Agent PII,
 * with no way for the customer to stop it (objectstack-ai/cloud#1508).
 *
 * Deployments that WANT reporting inject `VITE_SENTRY_DSN` in their own deploy
 * environment at build time, exactly as they already inject `VITE_SERVER_URL`.
 */
// Read through Vite's `?raw` rather than `node:fs`: this app's tsconfig is
// browser-only, so a `node:fs` import fails `tsc` in the console's build even
// while the test itself passes under Vitest (same reason as
// `insecure-origin-crypto.placement.test.ts`).
import envProduction from '../../.env.production?raw';
import { describe, it, expect } from 'vitest';

/** Key/value pairs that are actually IN EFFECT — comments excluded. */
const activeAssignments = envProduction
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'))
  .map((line) => {
    const eq = line.indexOf('=');
    return eq === -1
      ? { key: line, value: '' }
      : { key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() };
  });

function valueOf(key: string): string | undefined {
  return activeAssignments.find((entry) => entry.key === key)?.value;
}

describe('apps/console/.env.production — telemetry endpoint', () => {
  // ── Vacuum guard ──────────────────────────────────────────────────────────
  // Every assertion below is an ABSENCE, which is precisely what a parser that
  // silently produced nothing would also satisfy. This case fails first if the
  // `?raw` import, the file path, or the comment-stripping ever stops
  // returning real content, so the absences stay evidence rather than noise.
  it('parsed real content (guards the absence assertions below)', () => {
    expect(envProduction.length).toBeGreaterThan(0);
    expect(activeAssignments.length).toBeGreaterThan(0);
    expect(valueOf('VITE_SERVER_URL')).toBeDefined();
    expect(valueOf('VITE_USE_MOCK_SERVER')).toBe('false');
  });

  it('does not commit a Sentry DSN', () => {
    const dsn = valueOf('VITE_SENTRY_DSN');
    expect(
      dsn === undefined || dsn === '',
      `VITE_SENTRY_DSN is set to ${JSON.stringify(dsn)} in apps/console/.env.production. ` +
        'Vite inlines it into the published pre-built SPA, which on-premises and air-gapped ' +
        'deployments embed and cannot switch off. Inject it from the deploy environment of ' +
        'the build that wants reporting instead.',
    ).toBe(true);
  });

  it('does not name a Sentry ingest host in any assignment that is in effect', () => {
    // Catches the DSN arriving under a different key, or smuggled into a
    // tunnel/transport option, which a `VITE_SENTRY_DSN`-only check misses.
    const offenders = activeAssignments.filter((entry) => /sentry\.io/i.test(entry.value));
    expect(offenders.map((entry) => entry.key)).toEqual([]);
  });

  it('does not turn PII collection on by default', () => {
    // `sendDefaultPii: true` is IP address + User-Agent on every event.
    expect(valueOf('VITE_SENTRY_SEND_DEFAULT_PII')).not.toBe('true');
  });
});
