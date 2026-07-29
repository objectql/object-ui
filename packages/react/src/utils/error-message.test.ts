/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';

import { extractFieldErrors } from './error-message';

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
