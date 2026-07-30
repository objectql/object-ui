// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `GET /api/v1/share-links/:token/resolve` has two producers, and the shared-record
 * page has to read both: the sharing plugin's routes and the runtime dispatcher's
 * `/share-links` domain (the designed primary surface for cloud's per-environment
 * kernels). The dispatcher has always answered `{ success: true, data }`;
 * objectstack#3983 moved the plugin onto the same shape, so the bare body is what a
 * pre-#3983 server still sends.
 *
 * The page was already tolerant of both — but only the BARE branch renamed the
 * wire's `redactFields` to the `redactedFields` the render reads. The enveloped
 * branch handed `body.data` through verbatim, so on the dispatcher path
 * `redactedFields` was `undefined` and the "Some fields are hidden by the owner"
 * notice never rendered — on exactly the pages where fields WERE being stripped.
 * Converting the plugin surface would have spread that to every share page, which
 * is why the rename moved into one function with these tests on it.
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeResolvedShare,
  type ResolveResponseBody,
  type ShareLink,
} from './shared-record-shape';

const LINK: ShareLink = {
  id: 'sl_1',
  token: 'tok_abcdefgh',
  object_name: 'crm_account',
  record_id: 'acc_1',
  permission: 'view',
  audience: 'anyone',
  expires_at: null,
  label: 'For the auditor',
};

const RECORD = { id: 'acc_1', name: 'Acme' };

/** The enveloped body, as both producers now send it. */
const enveloped = (data: ResolveResponseBody['data']): ResolveResponseBody => ({ data });

describe('normalizeResolvedShare — both producers fold to one shape', () => {
  it('reads the ENVELOPED body (dispatcher, and the plugin after objectstack#3983)', () => {
    const out = normalizeResolvedShare(
      enveloped({ record: RECORD, link: LINK, redactFields: ['ssn'] }),
    );
    expect(out.record).toEqual(RECORD);
    expect(out.link.token).toBe('tok_abcdefgh');
    // The regression: this was `undefined` on the enveloped path, so the
    // redaction notice silently disappeared.
    expect(out.redactedFields).toEqual(['ssn']);
  });

  it('reads the BARE body (a pre-objectstack#3983 plugin surface)', () => {
    const out = normalizeResolvedShare({ record: RECORD, link: LINK, redactFields: ['ssn'] });
    expect(out.record).toEqual(RECORD);
    expect(out.link.token).toBe('tok_abcdefgh');
    expect(out.redactedFields).toEqual(['ssn']);
  });

  it('agrees on both shapes — the whole point of normalising in one place', () => {
    const payload = { record: RECORD, link: LINK, redactFields: ['ssn', 'dob'] };
    expect(normalizeResolvedShare(enveloped(payload))).toEqual(normalizeResolvedShare(payload));
  });

  it('leaves redactedFields undefined when the server redacted nothing', () => {
    expect(normalizeResolvedShare(enveloped({ record: RECORD, link: LINK })).redactedFields)
      .toBeUndefined();
    // …and an EMPTY list stays empty rather than collapsing to undefined: the
    // render guards on `.length > 0`, so both are correctly silent, but conflating
    // them would hide a producer that started answering `[]` for "nothing stripped".
    expect(normalizeResolvedShare(enveloped({ record: RECORD, link: LINK, redactFields: [] })).redactedFields)
      .toEqual([]);
  });

  it('never hands the render a null record — it JSON.stringifies it unguarded', () => {
    expect(normalizeResolvedShare(enveloped({ link: LINK })).record).toEqual({});
  });
});
