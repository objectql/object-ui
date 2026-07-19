/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { isSystemManagedField, SYSTEM_MANAGED_FIELD_NAMES } from '@object-ui/types';

describe('isSystemManagedField', () => {
  it('treats fields flagged `system: true` as system-managed (the single source of truth)', () => {
    expect(isSystemManagedField('anything_custom', { system: true })).toBe(true);
    // Flag wins even for a name that is not in the canonical set — covers
    // future framework-injected fields without editing the name list.
    expect(isSystemManagedField('brand_new_injected_field', { system: true })).toBe(true);
  });

  it('classifies the injected owner_id as system-managed by flag AND by name', () => {
    expect(isSystemManagedField('owner_id', { system: true })).toBe(true); // stamped by registry
    expect(isSystemManagedField('owner_id', {})).toBe(true);               // name fallback (no flag)
    expect(isSystemManagedField('owner_id')).toBe(true);                   // name fallback (no field)
  });

  it('classifies audit / identity / tenancy columns by name when no flag is present', () => {
    for (const name of ['id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'organization_id']) {
      expect(isSystemManagedField(name, {})).toBe(true);
    }
  });

  it('does NOT classify author-declared business fields as system-managed', () => {
    expect(isSystemManagedField('name', {})).toBe(false);
    expect(isSystemManagedField('f_email', { system: false })).toBe(false);
    expect(isSystemManagedField('amount')).toBe(false);
  });

  it('exposes owner_id and the tenancy FKs in the canonical name set', () => {
    expect(SYSTEM_MANAGED_FIELD_NAMES.has('owner_id')).toBe(true);
    expect(SYSTEM_MANAGED_FIELD_NAMES.has('organization_id')).toBe(true);
    expect(SYSTEM_MANAGED_FIELD_NAMES.has('created_at')).toBe(true);
    expect(SYSTEM_MANAGED_FIELD_NAMES.has('name')).toBe(false);
  });
});
