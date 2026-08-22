/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Is THIS record editable by the current user? (objectstack#3821)
 *
 * Object-level permissions can't answer that. A record shared read-only via a
 * sharing rule sits inside an object the user may otherwise create and edit
 * freely — so the header offered a primary "Edit" CTA that opened the form, let
 * the user retype a field, and only then bounced with a 403. The server is the
 * authority (the framework's ADR-0057 D10 — framework numbering; this repo's
 * own ADR-0057 is an unrelated document) and stays so; this is the courtesy
 * check that stops the UI from inviting a write it knows will fail.
 *
 * The answer comes from the explain engine's record-grained verdict
 * (`POST /api/v1/security/explain` with a `recordId`, ADR-0090 D6 / ADR-0095
 * C2) — the same pipeline the enforcement middleware runs, so the button and
 * the server can't disagree. Explaining ONESELF needs no special permission;
 * only explaining another principal does.
 *
 * **Fail-open on every uncertainty** — no answer yet, a non-OK response, a
 * deployment without `@objectstack/plugin-security` (501), a split SPA origin
 * where the cookie doesn't reach the API: the button stays enabled and the
 * server does its job. A permission hint must never be the reason a permitted
 * user cannot act.
 *
 * The probe rides the host's AUTHENTICATED fetch (`SchemaRendererProvider`'s
 * `apiFetch`, the same channel `provider: 'api'` view sources use), not the bare
 * global one. A bearer-token session carries its credential in the
 * `Authorization` header, not a cookie, so `credentials: 'include'` alone made
 * every probe 401 on a perfectly valid admin session — the verdict then always
 * failed open and this hook was dead weight in exactly the deployments it was
 * written for (framework#3923 ②). Cookies stay on for cookie-session hosts.
 */
import * as React from 'react';
import { SchemaRendererContext } from '@object-ui/react';

/** Cache keyed by `object:recordId:operation` so revisiting a record is free. */
const verdictCache = new Map<string, boolean>();

export type RecordOperation = 'update' | 'delete';

export function useRecordEditable(
  objectName: string | undefined,
  recordId: string | undefined,
  operation: RecordOperation = 'update',
  enabled = true,
): boolean {
  const key = objectName && recordId ? `${objectName}:${recordId}:${operation}` : '';
  const [allowed, setAllowed] = React.useState<boolean>(() =>
    key && verdictCache.has(key) ? verdictCache.get(key)! : true,
  );
  // Read the context directly (not `useSchemaContext`, which throws when no
  // provider is mounted): a standalone `detail:view` embed has no host fetch
  // and must still degrade to the global one rather than crash the render.
  const apiFetch = React.useContext(SchemaRendererContext)?.apiFetch;

  React.useEffect(() => {
    if (!enabled || !key) {
      setAllowed(true);
      return;
    }
    if (verdictCache.has(key)) {
      setAllowed(verdictCache.get(key)!);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const doFetch = apiFetch ?? fetch;
        const res = await doFetch('/api/v1/security/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ object: objectName, operation, recordId }),
        });
        if (!res.ok) return; // 401 / 403 / 501 → fail open
        const decision = await res.json();
        const verdict = decision?.record?.visible;
        if (typeof verdict !== 'boolean') return; // no record verdict → fail open
        verdictCache.set(key, verdict);
        if (!cancelled) setAllowed(verdict);
      } catch {
        /* network/parse failure → fail open */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, objectName, recordId, operation, enabled, apiFetch]);

  return allowed;
}

/** Test seam — drops the memoised verdicts. */
export function __clearRecordEditableCache(): void {
  verdictCache.clear();
}
