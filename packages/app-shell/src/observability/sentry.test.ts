/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 */

/**
 * objectui#5522 — the Sentry gate must fail CLOSED.
 *
 * What makes this file worth having is that the acceptance condition is an
 * ABSENCE ("no envelopes left the browser"), and absence is the one shape a
 * broken test reproduces perfectly: a suite that never reaches an enabled
 * verdict, for any reason at all, reads exactly like a suite proving the gate
 * works. So every negative case below is paired with a COUNTER-PROBE — a
 * posture that SHOULD report, asserted to actually be granted. If the
 * counter-probe ever goes green-by-vacuum, it fails, and the negatives stop
 * being evidence of anything.
 *
 * The decision is tested through `resolveSentryGate`, the pure seam, rather
 * than by stubbing env vars around `initSentry`. That is a measured
 * constraint, not a preference: this repo's Vitest exposes only
 * `BASE_URL`/`DEV`/`MODE`/`PROD`/`SSR` on `import.meta.env`, and `vi.stubEnv`
 * writes to `process.env` WITHOUT reaching `import.meta.env` — so an
 * env-stubbing suite silently tests nothing but the no-DSN branch. (Measured:
 * the first draft of this file did exactly that, and its five positive cases
 * all failed while its three absence cases "passed".) `initSentry` is still
 * covered below for the posture that ships by default, and the enabled path
 * is covered end-to-end by the production-build counter-probe recorded on the
 * pull request.
 *
 * The gate now takes TWO grants — a build-time DSN and the runtime's
 * `telemetry.allowClientErrorReporting` permission — so each half is pinned
 * against a GRANTING counterpart, never against a second denial. Testing "no
 * DSN and no permission ⇒ silence" would prove nothing about either.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveSentryGate } from './sentry';
import { isClientErrorReportingAllowed, resetRuntimeConfigForTesting } from '../runtime-config.js';

const DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

/**
 * The runtime's answer, named rather than spelled `true`/`false` at 30 call
 * sites: `resolveSentryGate(env, false)` reads as "some boolean", while
 * `RUNTIME_GRANTS` states which of the two grants a case is holding fixed.
 */
const RUNTIME_GRANTS = true;
const RUNTIME_DENIES = false;

const sentryMock = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
}));

vi.mock('@sentry/react', () => sentryMock);

describe('resolveSentryGate — fails closed when the build-time opt-in is absent', () => {
  // Every case here holds the RUNTIME grant fixed at "allowed", so a denial can
  // only be coming from the build-time half. Pairing two denials would let
  // either one carry the result while the other rotted.

  it('withholds reporting when no DSN was injected', () => {
    expect(resolveSentryGate({}, RUNTIME_GRANTS)).toMatchObject({ enabled: false, reason: 'no-dsn' });
  });

  it('withholds reporting when the env object itself is missing', () => {
    // `(import.meta as any).env` can legitimately be undefined outside Vite.
    // "Cannot determine the signal" must land on silence, not on send.
    expect(resolveSentryGate(undefined, RUNTIME_GRANTS)).toMatchObject({ enabled: false, reason: 'no-dsn' });
    expect(resolveSentryGate(null, RUNTIME_GRANTS)).toMatchObject({ enabled: false, reason: 'no-dsn' });
  });

  it('treats an empty or whitespace-only DSN as absent', () => {
    expect(resolveSentryGate({ VITE_SENTRY_DSN: '' }, RUNTIME_GRANTS)).toMatchObject({ enabled: false });
    expect(resolveSentryGate({ VITE_SENTRY_DSN: '   ' }, RUNTIME_GRANTS)).toMatchObject({ enabled: false });
  });

  it('treats a non-string DSN as absent rather than coercing it', () => {
    expect(resolveSentryGate({ VITE_SENTRY_DSN: true }, RUNTIME_GRANTS)).toMatchObject({ enabled: false });
    expect(resolveSentryGate({ VITE_SENTRY_DSN: 1 }, RUNTIME_GRANTS)).toMatchObject({ enabled: false });
  });

  it('honours the explicit force-off even when a DSN was injected', () => {
    expect(
      resolveSentryGate({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENABLED: 'false' }, RUNTIME_GRANTS),
    ).toMatchObject({
      enabled: false,
      reason: 'forced-off',
    });
  });

  it('never reports PII on any withheld verdict', () => {
    // Belt and braces: a disabled verdict that still carried
    // `sendDefaultPii: true` would be one refactor away from leaking.
    for (const env of [
      {},
      { VITE_SENTRY_SEND_DEFAULT_PII: 'true' },
      { VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENABLED: 'false', VITE_SENTRY_SEND_DEFAULT_PII: 'true' },
    ]) {
      const decision = resolveSentryGate(env, RUNTIME_GRANTS);
      expect(decision.enabled).toBe(false);
      expect(decision.sendDefaultPii).toBe(false);
    }
  });
});

/**
 * The post-build off switch (objectui#5522 / objectstack#10805, cloud#1508).
 *
 * The half that could not be built before: every other input to this gate is a
 * Vite build-time variable frozen into the bundle, so an air-gapped EE Console
 * running the SAME artifact as the hosted console had no way to be silenced.
 * These cases hold the BUILD-time grant fixed at "fully opted in" — a real DSN,
 * no force-off — so a denial can only be coming from the runtime.
 */
describe('resolveSentryGate — the runtime permission can silence a build that opted in', () => {
  it('withholds reporting when the runtime declines, DSN notwithstanding', () => {
    expect(resolveSentryGate({ VITE_SENTRY_DSN: DSN }, RUNTIME_DENIES)).toMatchObject({
      enabled: false,
      reason: 'runtime-denied',
    });
  });

  it('still reports the DSN it refused, so a silent deployment is diagnosable', () => {
    // The operator's question is "why is nothing arriving" — `reason` has to
    // distinguish "you shipped no DSN" from "your runtime said no", and the
    // second is invisible from inside the artifact.
    expect(resolveSentryGate({ VITE_SENTRY_DSN: DSN }, RUNTIME_DENIES).dsn).toBe(DSN);
  });

  it('sends no PII on a runtime denial even when the build asked for it', () => {
    const decision = resolveSentryGate(
      { VITE_SENTRY_DSN: DSN, VITE_SENTRY_SEND_DEFAULT_PII: 'true' },
      RUNTIME_DENIES,
    );
    expect(decision.enabled).toBe(false);
    expect(decision.sendDefaultPii).toBe(false);
  });

  it('requires a real `true`, so no truthy value can grant by accident', () => {
    // `!== true` rather than `!`. The parameter is typed `boolean`, but this
    // gate is the last thing standing between an air-gapped network and
    // sentry.io, and JS callers exist. A permission must be granted, never
    // coerced.
    for (const truthy of ['true', 1, 'yes', {}, [], 'granted']) {
      expect(
        resolveSentryGate({ VITE_SENTRY_DSN: DSN }, truthy as unknown as boolean).enabled,
        `runtime permission ${JSON.stringify(truthy)} must not grant`,
      ).toBe(false);
    }
  });

  it('denies on BOTH halves missing without masking either reason', () => {
    // Order matters only for the diagnostic: no DSN is the more actionable
    // answer, so it wins the `reason` slot when both are absent.
    expect(resolveSentryGate({}, RUNTIME_DENIES)).toMatchObject({ enabled: false, reason: 'no-dsn' });
  });
});

describe('counter-probe — a posture that SHOULD report still does', () => {
  it('grants reporting when a DSN was injected at build time AND the runtime allows it', () => {
    // The whole point: the fix must not silently disable the hosted SaaS
    // build, which opts in by injecting a DSN in its own deploy environment
    // and runs on a runtime that grants the permission. If this case ever goes
    // red, the absence assertions above stop meaning "the gate is careful" and
    // start meaning "the gate is stuck shut".
    expect(resolveSentryGate({ VITE_SENTRY_DSN: DSN }, RUNTIME_GRANTS)).toMatchObject({
      enabled: true,
      reason: 'opted-in',
      dsn: DSN,
    });
  });

  it('does NOT require a separate enable flag alongside the DSN', () => {
    // Presence of the DSN is the build-time opt-in. Were `VITE_SENTRY_ENABLED=true`
    // ever made mandatory, the SaaS pipeline would go dark the moment it forgot
    // the second variable — a quiet failure, which is the direction this card
    // exists to avoid.
    expect(resolveSentryGate({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENABLED: undefined }, RUNTIME_GRANTS).enabled).toBe(true);
    expect(resolveSentryGate({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENABLED: '' }, RUNTIME_GRANTS).enabled).toBe(true);
    expect(resolveSentryGate({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENABLED: 'true' }, RUNTIME_GRANTS).enabled).toBe(true);
  });

  it('trims a padded DSN rather than rejecting it', () => {
    expect(resolveSentryGate({ VITE_SENTRY_DSN: `  ${DSN}  ` }, RUNTIME_GRANTS)).toMatchObject({ enabled: true, dsn: DSN });
  });
});

describe('sendDefaultPii — opt-in, because one artifact ships to every posture', () => {
  it('is OFF when the build said nothing about it', () => {
    expect(resolveSentryGate({ VITE_SENTRY_DSN: DSN }, RUNTIME_GRANTS).sendDefaultPii).toBe(false);
  });

  it('is ON only when the build explicitly asked for it', () => {
    expect(
      resolveSentryGate({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_SEND_DEFAULT_PII: 'true' }, RUNTIME_GRANTS).sendDefaultPii,
    ).toBe(true);
  });

  it('stays OFF for every near-miss spelling', () => {
    // `!== 'false'` was the old test, so anything-but-false used to mean ON.
    // These are the values that flipped meaning; none of them may enable PII.
    for (const value of ['false', 'TRUE', 'True', '1', 'yes', 'on', '']) {
      expect(
        resolveSentryGate({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_SEND_DEFAULT_PII: value }, RUNTIME_GRANTS).sendDefaultPii,
        `VITE_SENTRY_SEND_DEFAULT_PII=${JSON.stringify(value)} must not enable PII`,
      ).toBe(false);
    }
  });
});

describe('initSentry — the posture that actually ships', () => {
  afterEach(() => {
    resetRuntimeConfigForTesting();
  });

  it('does not initialize, and does not load the SDK, on a build with no DSN', async () => {
    // `import.meta.env` under Vitest carries no VITE_SENTRY_DSN, which is
    // exactly the shape of a console build that never opted in. Not merely
    // "no events sent": `Sentry.init` never runs, which is what keeps the
    // vendor-sentry chunk unfetched — no third-party request at all.
    const { initSentry, getSentry } = await import('./sentry');

    await expect(initSentry()).resolves.toBe(false);
    expect(sentryMock.init).not.toHaveBeenCalled();
    expect(getSentry()).toBeNull();
  });

  it('agrees with the pure gate about the two inputs it actually reads', () => {
    // Ties the halves together: whatever `import.meta.env` and the runtime
    // config singleton hold in this run, `initSentry`'s verdict above must be
    // the one `resolveSentryGate` derives from them. Without this, the pure
    // tests and the wiring test could drift apart and both stay green.
    expect(resolveSentryGate((import.meta as any).env, isClientErrorReportingAllowed()).enabled).toBe(false);
  });

  it('reads the runtime permission as DENIED before any config has been fetched', () => {
    // The state `initSentry` sees if it is ever called before
    // `initRuntimeConfig()` settles. It must be denial: the console's boot
    // ordering is what guarantees the permission has arrived, and the cost of
    // getting that ordering wrong has to be silence, never a leak.
    resetRuntimeConfigForTesting();
    expect(isClientErrorReportingAllowed()).toBe(false);
  });
});
