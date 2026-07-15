// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { OWD_MODELS, OWD_WIDTH, isExternalWider, deriveMasterObject } from './owd-sharing';

describe('owd-sharing — canonical values (ADR-0090 D4)', () => {
  it('offers exactly the four canonical models', () => {
    expect([...OWD_MODELS]).toEqual([
      'private',
      'public_read',
      'public_read_write',
      'controlled_by_parent',
    ]);
  });

  it('orders only the three org-wide-visible models on the width axis', () => {
    expect(OWD_WIDTH).toEqual({ private: 0, public_read: 1, public_read_write: 2 });
    // controlled_by_parent deliberately has no width — it delegates to the master.
    expect('controlled_by_parent' in OWD_WIDTH).toBe(false);
  });
});

describe('owd-sharing — isExternalWider (ADR-0090 D11)', () => {
  it('flags an external baseline wider than the internal one', () => {
    expect(isExternalWider('public_read', 'public_read_write')).toBe(true);
    expect(isExternalWider('private', 'public_read')).toBe(true);
  });

  it('stays calm when external ≤ internal', () => {
    expect(isExternalWider('public_read_write', 'public_read')).toBe(false);
    expect(isExternalWider('public_read', 'public_read')).toBe(false);
    expect(isExternalWider('private', 'private')).toBe(false);
  });

  it('never trips on off-axis values (unset / controlled_by_parent)', () => {
    expect(isExternalWider('', 'public_read_write')).toBe(false);
    expect(isExternalWider('private', '')).toBe(false);
    expect(isExternalWider('controlled_by_parent', 'public_read_write')).toBe(false);
    expect(isExternalWider('private', 'controlled_by_parent')).toBe(false);
  });
});

describe('owd-sharing — deriveMasterObject', () => {
  it('reads the master-detail reference from a keyed-map fields shape', () => {
    const fields = {
      name: { type: 'text' },
      account: { type: 'master_detail', reference: 'crm_account' },
    };
    expect(deriveMasterObject(fields)).toBe('crm_account');
  });

  it('reads it from an array fields shape', () => {
    const fields = [
      { name: 'name', type: 'text' },
      { name: 'parent', type: 'master_detail', reference: 'crm_case' },
    ];
    expect(deriveMasterObject(fields)).toBe('crm_case');
  });

  it('returns undefined when there is no master-detail field', () => {
    expect(deriveMasterObject({ name: { type: 'text' } })).toBeUndefined();
    expect(deriveMasterObject(undefined)).toBeUndefined();
    // A master-detail field without a reference target resolves to undefined.
    expect(deriveMasterObject({ p: { type: 'master_detail' } })).toBeUndefined();
  });
});
