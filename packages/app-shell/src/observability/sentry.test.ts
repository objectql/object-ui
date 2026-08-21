/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 */

/**
 * objectui#5522 — the Sentry gate must fail CLOSED.
 *
 * What makes this file worth having is that the acceptance condition is an
 * ABSENCE ("no envelopes left the browser"), and absence is the one shape a
 * broken test reproduces perfectly: a suite that never reaches `Sentry.init`
 * for any reason at all reads exactly like a suite proving the gate works.
 * So every negative case below is paired with the COUNTER-PROBE in
 * `describe('counter-probe')` — a posture that SHOULD initialize and is
 * asserted to actually do so. If the counter-probe ever goes green-by-
 * vacuum (mock renamed, module path wrong, env stubbing silently inert),
 * it fails, and the negatives stop being evidence of anything.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const sentryMock = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
}));

vi.mock('@sentry/react', () => sentryMock);

const LIVE_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

/**
 * Re-import the module under test with a fresh module registry.
 * `initSentry()` memoises into a module-level `initPromise`, so without the
 * reset every test after the first would read the first test's decision.
 */
async function loadSentry() {
  vi.resetModules();
  return await import('./sentry');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('initSentry — fails closed when the opt-in signal is absent', () => {
  it('does not initialize, and does not load the SDK, when no DSN was injected', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');

    const { initSentry, getSentry } = await loadSentry();

    await expect(initSentry()).resolves.toBe(false);
    // Not merely "no events sent" — `Sentry.init` never runs, which is what
    // keeps the vendor-sentry chunk unfetched on a deployment that never
    // opted in. No third-party request at all, not even to load the SDK.
    expect(sentryMock.init).not.toHaveBeenCalled();
    expect(getSentry()).toBeNull();
  });

  it('treats a whitespace-only DSN as absent', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '   ');

    const { initSentry, getSentry } = await loadSentry();

    await expect(initSentry()).resolves.toBe(false);
    expect(sentryMock.init).not.toHaveBeenCalled();
    expect(getSentry()).toBeNull();
  });

  it('honours the explicit force-off even when a DSN was injected', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', LIVE_DSN);
    vi.stubEnv('VITE_SENTRY_ENABLED', 'false');

    const { initSentry } = await loadSentry();

    await expect(initSentry()).resolves.toBe(false);
    expect(sentryMock.init).not.toHaveBeenCalled();
  });
});

describe('counter-probe — a posture that SHOULD report still does', () => {
  it('initializes when a DSN was deliberately injected at build time', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', LIVE_DSN);

    const { initSentry, getSentry } = await loadSentry();

    // The whole point: the fix must not silently disable the hosted SaaS
    // build, which opts in by injecting a DSN in its own deploy environment.
    await expect(initSentry()).resolves.toBe(true);
    expect(sentryMock.init).toHaveBeenCalledTimes(1);
    expect(sentryMock.init.mock.calls[0]?.[0]).toMatchObject({ dsn: LIVE_DSN });
    expect(getSentry()).not.toBeNull();
  });

  it('does NOT require a separate enable flag alongside the DSN', async () => {
    // Presence of the DSN is the opt-in. If this ever starts failing because
    // an `VITE_SENTRY_ENABLED=true` was made mandatory, the SaaS pipeline
    // would go dark the moment it forgot the second variable.
    vi.stubEnv('VITE_SENTRY_DSN', LIVE_DSN);
    vi.stubEnv('VITE_SENTRY_ENABLED', '');

    const { initSentry } = await loadSentry();

    await expect(initSentry()).resolves.toBe(true);
    expect(sentryMock.init).toHaveBeenCalledTimes(1);
  });
});

describe('sendDefaultPii — opt-in, because one artifact ships to every posture', () => {
  it('is OFF when the build said nothing about it', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', LIVE_DSN);

    const { initSentry } = await loadSentry();
    await initSentry();

    // IP address + User-Agent. The inherited default must not be "collect".
    expect(sentryMock.init.mock.calls[0]?.[0]).toMatchObject({ sendDefaultPii: false });
  });

  it('is ON only when the build explicitly asked for it', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', LIVE_DSN);
    vi.stubEnv('VITE_SENTRY_SEND_DEFAULT_PII', 'true');

    const { initSentry } = await loadSentry();
    await initSentry();

    expect(sentryMock.init.mock.calls[0]?.[0]).toMatchObject({ sendDefaultPii: true });
  });

  it('stays OFF for the legacy opt-out spelling', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', LIVE_DSN);
    vi.stubEnv('VITE_SENTRY_SEND_DEFAULT_PII', 'false');

    const { initSentry } = await loadSentry();
    await initSentry();

    expect(sentryMock.init.mock.calls[0]?.[0]).toMatchObject({ sendDefaultPii: false });
  });
});
