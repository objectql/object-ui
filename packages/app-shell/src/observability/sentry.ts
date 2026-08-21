/**
 * Sentry integration — opt-in via `VITE_SENTRY_DSN`.
 *
 * Design goals:
 *  - **Zero cost when disabled.** `@sentry/react` is dynamically imported only
 *    when a DSN is configured, so apps without Sentry pay zero bundle bytes.
 *  - **Graceful degradation.** If init fails (network, CSP, etc.) we log a
 *    warning and continue — the host app must still render.
 *  - **Sensible defaults.** 10% transaction sampling, no session replay,
 *    `release` + `environment` pulled from Vite envvars.
 *
 * ## Fail direction: when in doubt, DO NOT SEND (objectui#5522)
 *
 * Every knob here is a Vite build-time variable, which Vite inlines into the
 * bundle as a FROZEN object literal. That is the whole hazard: a shipped
 * artifact cannot be reconfigured afterwards, so `VITE_SENTRY_ENABLED` reads
 * `undefined` forever on a build that did not define it, and editing env vars
 * or `.env` on the deployed host does nothing. `@object-ui/console` publishes
 * ONE pre-built SPA that both the hosted SaaS console and the on-premises /
 * air-gapped EE images embed, so anything baked in here lands inside customer
 * networks. An air-gapped EE deployment was measured sending 14 Sentry
 * envelopes per session to sentry.io with IP + User-Agent PII, unstoppable by
 * the customer (objectstack-ai/cloud#1508).
 *
 * Hence this module fails CLOSED, the opposite of the usual gate: an
 * unreported error is recoverable, PII leaving an air-gapped deployment is
 * not. The only affirmative opt-in signal a shipped bundle can carry is a DSN
 * that someone deliberately injected at build time. No DSN ⇒ `initSentry()`
 * returns `false` and `@sentry/react` is never imported, so the vendor-sentry
 * chunk is never even fetched. `apps/console/.env.production` therefore
 * commits NO DSN; deployments that want reporting inject one in their own
 * deploy environment (a ratchet test keeps it that way).
 *
 * ⚠️ Known limitation, deliberately not worked around here: a build that DID
 * opt in still has no post-build off switch, because the only server→SPA
 * channel is `/api/v1/runtime/config` and a telemetry key on that payload is
 * an objectstack contract change, not objectui's to make. Filed upstream; see
 * the issue for the fork. Until it lands, "do not inject a DSN" is the
 * off switch, and it is now a real one because none is committed.
 *
 * Env vars consumed (all optional):
 *  - `VITE_SENTRY_DSN`         — DSN; absent disables the integration entirely.
 *    Presence IS the opt-in — there is no separate "enable" flag to forget.
 *  - `VITE_SENTRY_ENABLED`     — set to `"false"` to force-disable reporting
 *    even when a DSN was injected. An ADDITIONAL off switch for a pipeline
 *    that wants to keep the DSN in its environment but stop reporting; it is
 *    build-time like everything else, so it cannot rescue an already-built
 *    artifact.
 *  - `VITE_SENTRY_SEND_DEFAULT_PII` — set to `"true"` to send IP address and
 *    User-Agent. Defaults to OFF: one artifact serves both SaaS and on-prem,
 *    so PII collection has to be the deliberate choice of the build that
 *    wants it, never the inherited default of the build that does not.
 *  - `VITE_SENTRY_ENVIRONMENT` — defaults to `MODE` (production/development)
 *  - `VITE_SENTRY_RELEASE`     — defaults to `VITE_APP_VERSION` or `unknown`
 *  - `VITE_SENTRY_TRACES_SAMPLE_RATE` — defaults to `0.1`
 *
 * @module
 */

type SentryModule = typeof import('@sentry/react');

let sentryModule: SentryModule | null = null;
let initPromise: Promise<boolean> | null = null;

/** The outcome of {@link resolveSentryGate}. */
export interface SentryGateDecision {
  /** Whether reporting may start at all. */
  enabled: boolean;
  /** Why — useful in tests and when explaining a silent deployment. */
  reason: 'no-dsn' | 'forced-off' | 'opted-in';
  /** The trimmed DSN, or `''` when there is none. */
  dsn: string;
  /** Whether IP address + User-Agent may be attached to events. */
  sendDefaultPii: boolean;
}

/**
 * The whole telemetry decision, as a pure function of the build-time env.
 *
 * Split out from {@link initSentry} deliberately. The decision is the part
 * with the security consequence, and leaving it inline made it unreachable
 * from tests: this repo's Vitest setup exposes only `BASE_URL`/`DEV`/`MODE`/
 * `PROD`/`SSR` on `import.meta.env`, and `vi.stubEnv` writes to `process.env`
 * WITHOUT reaching `import.meta.env` (measured — a suite that stubbed a DSN
 * and asserted "enabled" failed, because the module never saw it). An
 * untestable gate is how the previous one stayed broken; this one is pinned
 * case by case in `sentry.test.ts`.
 *
 * Fails CLOSED in every branch that is not an affirmative opt-in.
 */
export function resolveSentryGate(env: Record<string, unknown> | null | undefined): SentryGateDecision {
  const rawDsn = env?.VITE_SENTRY_DSN;
  const dsn = typeof rawDsn === 'string' ? rawDsn.trim() : '';

  // No deliberately-injected DSN ⇒ nothing to opt in to. This is the state a
  // build inherits when nobody asked for telemetry, and it must mean silence:
  // an unreported error is recoverable, PII leaving an air-gapped deployment
  // is not.
  if (!dsn) return { enabled: false, reason: 'no-dsn', dsn: '', sendDefaultPii: false };

  // The additional force-off, for a pipeline that keeps a DSN in its
  // environment but wants reporting stopped. Build-time like everything here,
  // so it cannot rescue an artifact that was already built.
  if (env?.VITE_SENTRY_ENABLED === 'false') {
    return { enabled: false, reason: 'forced-off', dsn, sendDefaultPii: false };
  }

  return {
    enabled: true,
    reason: 'opted-in',
    dsn,
    // OPT-IN, not opt-out: one artifact ships to every posture, so the build
    // that wants IP + User-Agent has to say so.
    sendDefaultPii: env?.VITE_SENTRY_SEND_DEFAULT_PII === 'true',
  };
}

/**
 * Returns the loaded Sentry module, or `null` if Sentry was never initialized
 * (e.g. DSN missing). Callers must handle the null case.
 */
export function getSentry(): SentryModule | null {
  return sentryModule;
}

/**
 * Initializes Sentry if `VITE_SENTRY_DSN` is configured. Safe to call multiple
 * times — only the first invocation runs.
 *
 * @returns `true` if Sentry was initialized, `false` if disabled or failed.
 */
export function initSentry(): Promise<boolean> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const env = (import.meta as any).env ?? {};
    const gate = resolveSentryGate(env);
    // Returning BEFORE the dynamic import is load-bearing, not an early-exit
    // micro-optimisation: it keeps the vendor-sentry chunk unfetched, so a
    // deployment that never opted in issues no third-party request at all —
    // not even one to load the SDK.
    if (!gate.enabled) return false;
    const dsn = gate.dsn;

    try {
      const Sentry = (await import('@sentry/react')) as SentryModule;
      const tracesSampleRate = Number(env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1');

      Sentry.init({
        dsn,
        environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE || 'production',
        release: env.VITE_SENTRY_RELEASE || env.VITE_APP_VERSION || 'unknown',
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
        // IP address + User-Agent — decided by `resolveSentryGate` above, and
        // OPT-IN there. Defaulting it on is how PII left an air-gapped network
        // in the first place (objectui#5522).
        sendDefaultPii: gate.sendDefaultPii,
        // Replay is opt-in via VITE_SENTRY_REPLAY=true to keep payload small.
        // When enabled, only 10% of error sessions are recorded.
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: env.VITE_SENTRY_REPLAY === 'true' ? 0.1 : 0,
        // Browser tracing — captures pageloads + navigation transactions.
        integrations: [Sentry.browserTracingIntegration()],
        // Strip query strings + Authorization from breadcrumbs before send.
        beforeBreadcrumb(breadcrumb) {
          if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
            if (breadcrumb.data?.url && typeof breadcrumb.data.url === 'string') {
              breadcrumb.data.url = stripSensitive(breadcrumb.data.url);
            }
          }
          return breadcrumb;
        },
      });

      sentryModule = Sentry;
      return true;
    } catch (err) {
      console.warn('[sentry] init failed; continuing without observability:', err);
      return false;
    }
  })();

  return initPromise;
}

/**
 * Reports an error to Sentry if initialized; otherwise no-op. Use this from
 * ErrorBoundary or any catch block where you want best-effort reporting.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryModule) return;
  try {
    sentryModule.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // never let observability break the host app
  }
}

/**
 * Sets the active user context for subsequent events. Pass `null` on logout.
 */
export function setSentryUser(user: { id?: string; email?: string; username?: string } | null): void {
  if (!sentryModule) return;
  try {
    sentryModule.setUser(user);
  } catch {
    /* swallow */
  }
}

function stripSensitive(url: string): string {
  try {
    const u = new URL(url, 'http://localhost');
    // Drop common token-shaped query params before sending to Sentry.
    for (const key of ['token', 'access_token', 'id_token', 'apiKey', 'api_key', 'password']) {
      if (u.searchParams.has(key)) u.searchParams.set(key, '[redacted]');
    }
    return u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '');
  } catch {
    return url;
  }
}
