/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4252 — an app the session may not open must be distinguishable from
 * an app that is not there.
 *
 * `GET /api/v1/meta/apps` is filtered per session server-side
 * (`filterAppForUser`), so those two conditions are byte-identical in the list:
 * both are simply absent. The maintainer ruling (2026-08-12) put the
 * distinction on the BY-NAME route instead of flagging the list — the
 * enumeration surface is not widened past what a by-name probe already implies
 * — and objectstack#8013 (PR #8135) shipped it:
 *
 *   - EXISTS + session lacks `requiredPermissions` → `403`
 *     `{ success: false, error: { code: 'PERMISSION_DENIED', message } }`
 *   - a nonexistent name, an unpublished app (ADR-0045 §3 keeps it externally
 *     unobservable), an app gated by an absent optional service (ADR-0057 D10 —
 *     nothing was denied to the CALLER) → `404 RESOURCE_NOT_FOUND`, unchanged.
 *
 * Every case here goes through the real `ObjectStackClient` over a stubbed
 * `fetch`, so what is measured includes the client's own error stamping
 * (`error.code` off `body.error.code`, `error.httpStatus` off the status) —
 * the seam a hand-built rejection would have skipped straight past.
 *
 * The discrimination is on the ADR-0112 CODE, never the status (objectui#4408),
 * and the last two cases are what hold that: they cross the two apart, so a
 * reimplementation that reads `httpStatus === 403` goes red in both directions
 * rather than passing on the happy path.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ObjectStackAdapter,
  isAppPermissionDeniedError,
  APP_PERMISSION_DENIED_CODE,
} from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** The 403 body objectstack#8135 emits, transcribed from that merged diff. */
const DENIED_BODY = {
  success: false,
  error: {
    code: 'PERMISSION_DENIED',
    message: "You do not have permission to open the 'finance' app.",
  },
};

/** The absence body the same route keeps answering for every other refusal. */
const ABSENT_BODY = {
  error: { code: 'RESOURCE_NOT_FOUND', message: 'Metadata item not found or access denied.' },
};

function makeAdapter(answer: (url: string) => Response) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => answer(String(input)));
  const adapter = new ObjectStackAdapter({ baseUrl: 'http://test.local', fetch: fetchImpl });
  return { adapter, fetchImpl };
}

describe('isAppPermissionDeniedError', () => {
  it('matches the by-name route\'s denial code, in either ADR-0112 spelling', () => {
    expect(APP_PERMISSION_DENIED_CODE).toBe('PERMISSION_DENIED');
    expect(isAppPermissionDeniedError({ code: 'PERMISSION_DENIED' })).toBe(true);
    // The console is versioned separately from the server it talks to; the
    // pre-ADR-0112 lowercase spelling still resolves (`errorCodeIs`).
    expect(isAppPermissionDeniedError({ code: 'permission_denied' })).toBe(true);
  });

  it('does NOT match absence, the enable-block denials, or a bare status', () => {
    expect(isAppPermissionDeniedError({ code: 'RESOURCE_NOT_FOUND' })).toBe(false);
    // `API_ACCESS_DENIED_CODES` (objectui#4408) is a different question: those
    // are pure functions of an object's `enable` metadata and identical for
    // every persona. This one is a statement about the caller.
    expect(isAppPermissionDeniedError({ code: 'OBJECT_API_DISABLED' })).toBe(false);
    expect(isAppPermissionDeniedError({ httpStatus: 403 })).toBe(false);
    expect(isAppPermissionDeniedError(undefined)).toBe(false);
  });
});

describe('ObjectStackAdapter.probeAppAccess — over the wire', () => {
  it('reports `denied` for the 403 PERMISSION_DENIED envelope', async () => {
    const { adapter, fetchImpl } = makeAdapter(() => json(403, DENIED_BODY));

    await expect(adapter.probeAppAccess('finance')).resolves.toBe('denied');
    // The by-name address, singular — what objectstack#8013 pinned its cases
    // against and what `MetadataProvider` already reads items by.
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/api/v1/meta/app/finance');
  });

  it('reports `unknown` for the 404 absence envelope — the copy must not move', async () => {
    const { adapter } = makeAdapter(() => json(404, ABSENT_BODY));
    await expect(adapter.probeAppAccess('no_such_app')).resolves.toBe('unknown');
  });

  it('reports `granted` when the route serves the app', async () => {
    const { adapter } = makeAdapter(() =>
      json(200, { type: 'app', name: 'finance', item: { name: 'finance', label: 'Finance' } }),
    );
    await expect(adapter.probeAppAccess('finance')).resolves.toBe('granted');
  });

  it('reports `unknown` — never `denied` — when the server cannot be reached', async () => {
    const { adapter } = makeAdapter(() => {
      throw new Error('network down');
    });
    await expect(adapter.probeAppAccess('finance')).resolves.toBe('unknown');
  });

  it('reports `unknown` for an empty name without asking anything', async () => {
    const { adapter, fetchImpl } = makeAdapter(() => json(200, {}));
    await expect(adapter.probeAppAccess('')).resolves.toBe('unknown');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never throws — a caller renders a screen off this, not a catch block', async () => {
    const { adapter } = makeAdapter(() => new Response('<html>gateway</html>', { status: 502 }));
    await expect(adapter.probeAppAccess('finance')).resolves.toBe('unknown');
  });

  // ── code, not status ─────────────────────────────────────────────────────
  //
  // Both directions, because a status-reading implementation passes every case
  // above. 403 is not the fact; `PERMISSION_DENIED` is.

  it('a 403 WITHOUT the code is `unknown` — a status alone never denies', async () => {
    const { adapter } = makeAdapter(() =>
      json(403, { error: { code: 'CSRF_TOKEN_INVALID', message: 'stale token' } }),
    );
    await expect(adapter.probeAppAccess('finance')).resolves.toBe('unknown');
  });

  it('the code decides even when the status is not 403', async () => {
    // Hypothetical on today's server, and deliberately so: the contract this
    // console consumes is the code. If the route ever answers the same denial
    // under a different status, the branch must follow the code — and if this
    // case is ever deleted, the reason must be that the CODE changed.
    const { adapter } = makeAdapter(() => json(401, DENIED_BODY));
    await expect(adapter.probeAppAccess('finance')).resolves.toBe('denied');
  });
});
