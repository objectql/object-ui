/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';

import { extractFieldErrors, classifyLoadError } from './error-message';

describe('extractFieldErrors', () => {
  // The wire shape the server actually sends: `@objectstack/rest` serves a
  // thrown `VALIDATION_FAILED` as 400 with `fields[]` passed through verbatim,
  // and `@objectstack/client` puts the whole body on `error.details` (the
  // envelope has no `details` key of its own, so the fallback applies).
  const serverEnvelope = {
    error: 'Name is required; Stage is not a valid option',
    code: 'VALIDATION_FAILED',
    fields: [
      { field: 'name', code: 'required', message: 'Name is required' },
      { field: 'stage', code: 'invalid_option', message: 'Stage is not a valid option', options: ['won', 'lost'] },
    ],
    object: 'crm_opportunity',
  };

  it('reads the raw client error, whose details carry the response body', () => {
    const err = Object.assign(new Error(serverEnvelope.error), {
      code: 'VALIDATION_FAILED',
      httpStatus: 400,
      details: serverEnvelope,
    });
    expect(extractFieldErrors(err)).toEqual([
      { field: 'name', message: 'Name is required' },
      { field: 'stage', message: 'Stage is not a valid option' },
    ]);
  });

  it('reads a normalised ValidationError from the ObjectStack adapter', () => {
    const err = Object.assign(new Error('Name is required'), {
      name: 'ValidationError',
      validationErrors: [{ field: 'name', message: 'Name is required' }],
    });
    expect(extractFieldErrors(err)).toEqual([{ field: 'name', message: 'Name is required' }]);
  });

  it('reads a hand-rolled error carrying `fields` directly', () => {
    // The server duck-types these identically (a hook may throw the shape
    // without going through objectql's class), so the client does too.
    const err = Object.assign(new Error('nope'), {
      fields: [{ field: 'amount', message: 'Amount must be positive' }],
    });
    expect(extractFieldErrors(err)).toEqual([{ field: 'amount', message: 'Amount must be positive' }]);
  });

  it('falls back to the machine code when an entry carries no message', () => {
    const err = { details: { fields: [{ field: 'name', code: 'required' }] } };
    expect(extractFieldErrors(err)).toEqual([{ field: 'name', message: 'required' }]);
  });

  it('drops entries with no field rather than guessing which input to mark', () => {
    const err = {
      details: { fields: [{ message: 'something is wrong' }, { field: 'name', message: 'Name is required' }] },
    };
    // Marking an innocent input is worse than the generic toast we already show.
    expect(extractFieldErrors(err)).toEqual([{ field: 'name', message: 'Name is required' }]);
  });

  it('returns null when the failure is not field-scoped', () => {
    const forbidden = Object.assign(new Error('insufficient privileges'), {
      code: 'FORBIDDEN',
      httpStatus: 403,
      details: { error: 'insufficient privileges', code: 'FORBIDDEN' },
    });
    expect(extractFieldErrors(forbidden)).toBeNull();
  });

  it('returns null for an empty fields array — a 400 with nothing to attribute', () => {
    expect(extractFieldErrors({ code: 'VALIDATION_FAILED', details: { fields: [] } })).toBeNull();
  });

  it('returns null for junk input', () => {
    expect(extractFieldErrors(null)).toBeNull();
    expect(extractFieldErrors(undefined)).toBeNull();
    expect(extractFieldErrors('a string')).toBeNull();
    expect(extractFieldErrors(new Error('plain'))).toBeNull();
  });
});

/**
 * `classifyLoadError` — lifted from `ListView`'s module scope (objectui#4693)
 * so `RecordAttachmentsPanel` can reuse the same "is this retry-invariant"
 * verdict. This is the unit-level pin at the shared home; `ListView` and
 * `RecordAttachmentsPanel` each pin their own consumption of it end-to-end in
 * their own test suites (`ListView.loadErrorKind.test.tsx`,
 * `RecordAttachmentsPanel.test.tsx`).
 */
describe('classifyLoadError', () => {
  it('classifies the enable-block denials as api-disabled, on the code alone', () => {
    expect(
      classifyLoadError(
        Object.assign(new Error('disabled'), { httpStatus: 404, code: 'OBJECT_API_DISABLED' }),
      ),
    ).toBe('api-disabled');
    expect(
      classifyLoadError(
        Object.assign(new Error('not allowed'), {
          httpStatus: 405,
          code: 'OBJECT_API_METHOD_NOT_ALLOWED',
        }),
      ),
    ).toBe('api-disabled');
    // No numeric status at all — the code alone must carry the verdict.
    expect(classifyLoadError(Object.assign(new Error('x'), { code: 'OBJECT_API_DISABLED' }))).toBe(
      'api-disabled',
    );
  });

  it('classifies 403 / PERMISSION_DENIED / FORBIDDEN as forbidden', () => {
    expect(classifyLoadError(Object.assign(new Error('x'), { httpStatus: 403 }))).toBe('forbidden');
    expect(classifyLoadError(Object.assign(new Error('x'), { code: 'PERMISSION_DENIED' }))).toBe(
      'forbidden',
    );
    expect(classifyLoadError(Object.assign(new Error('x'), { code: 'FORBIDDEN' }))).toBe('forbidden');
  });

  it('classifies 401 / UNAUTHORIZED / UNAUTHENTICATED as unauthorized', () => {
    expect(classifyLoadError(Object.assign(new Error('x'), { httpStatus: 401 }))).toBe(
      'unauthorized',
    );
    expect(classifyLoadError(Object.assign(new Error('x'), { code: 'UNAUTHENTICATED' }))).toBe(
      'unauthorized',
    );
  });

  it('classifies 400 and the known malformed-request codes as rejected', () => {
    expect(classifyLoadError(Object.assign(new Error('x'), { httpStatus: 400 }))).toBe('rejected');
    expect(classifyLoadError(Object.assign(new Error('x'), { code: 'INVALID_FILTER' }))).toBe(
      'rejected',
    );
    expect(
      classifyLoadError(Object.assign(new Error('x'), { code: 'UNSUPPORTED_QUERY_PARAM' })),
    ).toBe('rejected');
  });

  it('falls back to network for a bare failure or an unrecognized 404', () => {
    expect(classifyLoadError(new TypeError('Failed to fetch'))).toBe('network');
    // A bare 404 (missing record / unprovisioned collection) is NOT an
    // enable-block denial — status alone must never reach `api-disabled`.
    expect(classifyLoadError(Object.assign(new Error('x'), { httpStatus: 404 }))).toBe('network');
  });

  it('reads a status embedded in the message text ("HTTP 403 …")', () => {
    expect(classifyLoadError(new Error('ApiDataSource: HTTP 403 Forbidden — {}'))).toBe(
      'forbidden',
    );
  });

  it('prefers 403/401 over the 400 branch', () => {
    expect(
      classifyLoadError(Object.assign(new Error('x'), { httpStatus: 403, code: 'INVALID_FILTER' })),
    ).toBe('forbidden');
  });
});
