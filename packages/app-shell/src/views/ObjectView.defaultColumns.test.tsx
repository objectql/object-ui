/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { defaultListColumnsFromObject } from './ObjectView';

describe('defaultListColumnsFromObject', () => {
  // Mirrors how the framework's `applySystemFields` presents an object with no
  // declared list view to the console: the injected system fields (owner_id,
  // audit columns, tenancy FK) are spread to the FRONT of the field map and
  // carry `system: true`; `owner_id` is deliberately non-hidden / non-readonly
  // because ownership is reassignable. This is the exact `showcase_invoice`
  // shape from #2777.
  const invoiceLike = {
    fields: {
      owner_id: { type: 'lookup', label: 'Owner id', system: true },
      created_at: { type: 'datetime', system: true, readonly: true },
      created_by: { type: 'lookup', system: true, readonly: true },
      organization_id: { type: 'lookup', system: true, hidden: true },
      invoice_no: { type: 'text', label: '发票号' },
      account: { type: 'lookup', label: '客户' },
      contact: { type: 'lookup', label: '联系人' },
      owner: { type: 'user', label: '负责人' },
    },
  };

  it('#2777: does NOT lead the auto-list with the injected owner_id — business fields come first', () => {
    const cols = defaultListColumnsFromObject(invoiceLike, 5);
    expect(cols[0]).toBe('invoice_no');
    expect(cols).not.toContain('owner_id');
    expect(cols).not.toContain('created_at');
    expect(cols).not.toContain('created_by');
    expect(cols).not.toContain('organization_id');
    // The business `owner` (Field.user, display value) survives — only the
    // injected `owner_id` id column is dropped.
    expect(cols).toEqual(['invoice_no', 'account', 'contact', 'owner']);
  });

  it('excludes owner_id even when it arrives WITHOUT the system flag (name fallback)', () => {
    const cols = defaultListColumnsFromObject({
      fields: { owner_id: { type: 'lookup' }, title: { type: 'text' } },
    });
    expect(cols).toEqual(['title']);
  });

  it('honors highlightFields as the curated override (owner_id kept if explicitly listed)', () => {
    const cols = defaultListColumnsFromObject({
      highlightFields: ['invoice_no', 'owner_id'],
      fields: invoiceLike.fields,
    });
    expect(cols).toEqual(['invoice_no', 'owner_id']);
  });

  it('caps the auto-derived business columns at the requested limit', () => {
    const fields: Record<string, any> = { owner_id: { type: 'lookup', system: true } };
    for (let i = 0; i < 10; i++) fields[`b_${i}`] = { type: 'text' };
    const cols = defaultListColumnsFromObject({ fields }, 5);
    expect(cols).toHaveLength(5);
    expect(cols).not.toContain('owner_id');
    expect(cols[0]).toBe('b_0');
  });

  it('returns an empty list when the object has no fields', () => {
    expect(defaultListColumnsFromObject({})).toEqual([]);
    expect(defaultListColumnsFromObject(undefined)).toEqual([]);
  });
});
