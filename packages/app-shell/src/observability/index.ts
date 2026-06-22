/**
 * Observability primitives — Sentry integration.
 *
 * All exports are no-op safe when no DSN is configured. See sentry.ts for
 * configuration via `VITE_SENTRY_*` envvars.
 *
 * @module
 */

export { initSentry, captureError, setSentryUser, getSentry } from './sentry';
export {
  beginRequest,
  endRequest,
  getPendingRequests,
  isIdle,
  subscribeSettle,
  whenIdle,
  withSettleSignal,
  installSettleSignalGlobal,
  type ObjectUiGlobal,
} from './settleSignal';
