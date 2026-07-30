/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Retry primitives for {@link MePermissionsProvider}'s `/me/permissions` fetch.
 *
 * Their own module rather than the component's: they are plain functions with
 * plain tests, and a component file that also exports helpers breaks fast
 * refresh.
 */

/** Upper bound on any single backoff wait, so a bad `Retry-After` cannot park the UI. */
export const MAX_RETRY_DELAY_MS = 30_000;

/**
 * Statuses that mean "not now", so retrying can succeed without anything
 * changing on the caller's side:
 *
 *  - `408` / `425` — the request itself did not land.
 *  - `429` — rate limited; `Retry-After` usually accompanies it.
 *  - `502` / `503` / `504` — the upstream is absent, warming or timing out.
 *    `503` is the load-bearing one here: on a multi-tenant host this endpoint is
 *    served by the environment kernel that owns the session, and the framework
 *    answers `503` + `Retry-After` while a cold one is still being built
 *    (objectstack#4159).
 *
 * Deliberately NOT retried: `401` / `403` (a real answer about this caller),
 * `404` (no such endpoint — retrying cannot conjure one) and `500` (a genuine
 * server fault; hammering it neither helps nor is honest about the failure).
 */
export const TRANSIENT_STATUS: ReadonlySet<number> = new Set([408, 425, 429, 502, 503, 504]);

/** An `Error` that also carries the HTTP status it came from. */
export class PermissionsFetchError extends Error {
  constructor(readonly status: number, readonly retryAfterMs?: number) {
    super(`Permissions endpoint returned ${status}`);
    this.name = 'PermissionsFetchError';
  }
}

/**
 * Whether a failed attempt is worth re-attempting. A THROWN fetch (offline,
 * DNS, aborted connection) is transient the same way a `503` is — the request
 * never got an answer at all.
 */
export function isTransientFailure(err: unknown): boolean {
  return err instanceof PermissionsFetchError ? TRANSIENT_STATUS.has(err.status) : true;
}

/**
 * `Retry-After` in ms, or `undefined` when absent/unparseable. Accepts both wire
 * forms (delta-seconds and an HTTP-date) and clamps to {@link MAX_RETRY_DELAY_MS}
 * so a hostile or buggy value cannot park the UI on its loading state for hours.
 */
export function parseRetryAfterMs(value: string | null | undefined, nowMs: number): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  let ms: number;
  if (/^\d+$/.test(trimmed)) {
    ms = Number(trimmed) * 1000;
  } else {
    const at = Date.parse(trimmed);
    if (Number.isNaN(at)) return undefined;
    ms = at - nowMs;
  }
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  return Math.min(ms, MAX_RETRY_DELAY_MS);
}

/** How long to wait before attempt `attempt + 1`. A server-stated delay wins. */
export function backoffMs(attempt: number, baseDelayMs: number, statedMs?: number): number {
  if (statedMs !== undefined) return statedMs;
  return Math.min(baseDelayMs * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

export const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
