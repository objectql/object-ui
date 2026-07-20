/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Helpers for turning a failed data-source write into user-facing feedback.
 *
 * Different DataSource adapters throw differently shaped errors:
 *   - the ObjectStack adapter (`@object-ui/data-objectstack`) decorates the
 *     thrown Error with `httpStatus` + a machine-readable `code` and puts the
 *     server text on `.message` (sometimes also a parsed body on `.details`);
 *   - `ApiDataSource` appends the raw JSON response body as a tail on the
 *     message string (`… — {"error":…,"code":…}`).
 *
 * These helpers normalise across both so a caller's `catch` can surface the
 * real reason (e.g. a row-level-security denial) instead of swallowing it.
 */

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

/**
 * Pull a clean, human-readable message out of a failed write. Strips noisy
 * backend prefixes (`[Security] `, `PERMISSION_DENIED: `) so it reads well in a
 * toast — mirrors `plugin-detail`'s `cleanError`. Returns `null` when nothing
 * usable can be extracted, so callers fall back to a generic localized string.
 */
export function extractWriteErrorMessage(err: unknown): string | null {
  const e = err as Record<string, any> | null | undefined;

  // 1) Structured server body, when the adapter attaches one.
  let msg =
    e && typeof e === 'object'
      ? firstString(e.details?.error, e.details?.message, e.error)
      : null;

  // 2) Otherwise the Error message itself. ApiDataSource embeds the raw JSON
  //    response body as a tail — parse it out when present.
  if (!msg) {
    const raw =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : typeof e?.message === 'string'
            ? e.message
            : '';
    const brace = raw.indexOf('{');
    if (brace >= 0) {
      try {
        const body = JSON.parse(raw.slice(brace));
        msg = firstString(body?.error, body?.message);
      } catch {
        /* tail wasn't JSON — fall through to the raw message */
      }
    }
    if (!msg && raw.trim()) msg = raw;
  }

  if (!msg) return null;
  const clean = msg
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^[A-Z][A-Z0-9_]+:\s*/, '')
    .trim();
  return clean || null;
}

/**
 * True when a failed write was rejected for authorization reasons (HTTP 403 /
 * `PERMISSION_DENIED` / `FORBIDDEN` / a row-level-security denial). Lets a
 * caller show a friendly "you don't have permission" toast rather than dumping
 * the raw server text.
 */
export function isPermissionError(err: unknown): boolean {
  const e = err as Record<string, any> | null | undefined;
  if (!e || typeof e !== 'object') return false;
  const status = e.httpStatus ?? e.status ?? e.statusCode;
  if (status === 403) return true;
  const code = firstString(e.code, e.details?.code) ?? '';
  if (code === 'PERMISSION_DENIED' || code === 'FORBIDDEN') return true;
  const text = `${typeof e.message === 'string' ? e.message : ''} ${
    e.details?.error ?? e.error ?? ''
  }`;
  return /row-level security|access denied|permission denied|not permitted/i.test(
    text,
  );
}
