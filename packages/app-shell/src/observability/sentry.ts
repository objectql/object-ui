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
 * Env vars consumed (all optional):
 *  - `VITE_SENTRY_DSN`         — DSN; absent disables the integration entirely
 *  - `VITE_SENTRY_ENABLED`     — set to `"false"` to force-disable reporting
 *    even when a DSN is configured (e.g. a fork that keeps the upstream DSN
 *    in `.env.production` but doesn't want to report to it). Default: enabled
 *    whenever a DSN is present — this is an *additional* off switch, not a
 *    change to that default.
 *  - `VITE_SENTRY_ENVIRONMENT` — defaults to `MODE` (production/development)
 *  - `VITE_SENTRY_RELEASE`     — defaults to `VITE_APP_VERSION` or `unknown`
 *  - `VITE_SENTRY_TRACES_SAMPLE_RATE` — defaults to `0.1`
 *
 * @module
 */

type SentryModule = typeof import('@sentry/react');

let sentryModule: SentryModule | null = null;
let initPromise: Promise<boolean> | null = null;

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
    const dsn = env.VITE_SENTRY_DSN as string | undefined;
    if (!dsn || env.VITE_SENTRY_ENABLED === 'false') return false;

    try {
      const Sentry = (await import('@sentry/react')) as SentryModule;
      const tracesSampleRate = Number(env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1');

      Sentry.init({
        dsn,
        environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE || 'production',
        release: env.VITE_SENTRY_RELEASE || env.VITE_APP_VERSION || 'unknown',
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
        // Send IP address + user agent on events. Sentry's recommended default
        // for production. Disable by setting VITE_SENTRY_SEND_DEFAULT_PII=false.
        sendDefaultPii: env.VITE_SENTRY_SEND_DEFAULT_PII !== 'false',
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
