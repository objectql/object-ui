/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_COLUMN_IDENTITY_KEY,
  LEGACY_COLUMN_IDENTITY_KEYS,
  TABLE_ADAPTER_COLUMN_KEY,
  columnIdentity,
  hasConflictingColumnIdentity,
  normalizeColumnIdentity,
  normalizeColumnIdentities,
} from '../column-identity';
import { normalizeListViewSchema } from '../normalize-list-view';
import { buildExpandFields } from '../expand-fields';

describe('columnIdentity (#3104)', () => {
  it('reads the spec-canonical `field`', () => {
    expect(columnIdentity({ field: 'stage' })).toBe('stage');
  });

  it('reads a bare string column', () => {
    expect(columnIdentity('stage')).toBe('stage');
  });

  it('falls back to the legacy `name`, then `fieldName`', () => {
    expect(columnIdentity({ name: 'stage' })).toBe('stage');
    expect(columnIdentity({ fieldName: 'stage' })).toBe('stage');
    expect(columnIdentity({ name: 'a', fieldName: 'b' })).toBe('a');
  });

  it('lets the canonical key win over every legacy spelling', () => {
    expect(columnIdentity({ field: 'account', name: 'account_name' })).toBe('account');
    expect(columnIdentity({ field: 'a', name: 'b', fieldName: 'c' })).toBe('a');
  });

  it('agrees with what `buildExpandFields` already resolves', () => {
    // The two must not drift: `buildExpandFields` IS the request path, and the
    // whole defect is the render path resolving something else.
    const fields = { account: { type: 'lookup', reference: 'accounts' } };
    const column = { field: 'account', name: 'account_name' };
    expect(buildExpandFields(fields, [column])).toEqual([columnIdentity(column)]);
  });

  it('returns undefined — not an empty string — when nothing is resolvable', () => {
    expect(columnIdentity({})).toBeUndefined();
    expect(columnIdentity({ field: '' })).toBeUndefined();
    expect(columnIdentity('')).toBeUndefined();
    expect(columnIdentity(null)).toBeUndefined();
    expect(columnIdentity(undefined)).toBeUndefined();
    expect(columnIdentity(42)).toBeUndefined();
  });

  it('skips an empty canonical key rather than resolving to it', () => {
    expect(columnIdentity({ field: '', name: 'stage' })).toBe('stage');
  });

  it('does NOT read the TanStack adapter key', () => {
    // `accessorKey` names a slot in the table library's column model, not a
    // field in ObjectStack metadata. Reading it here would merge the two
    // vocabularies — the mistake this battle exists to undo.
    expect(TABLE_ADAPTER_COLUMN_KEY).toBe('accessorKey');
    expect(columnIdentity({ accessorKey: 'stage' })).toBeUndefined();
  });
});

describe('hasConflictingColumnIdentity (#3104)', () => {
  it('flags a column whose keys disagree', () => {
    expect(hasConflictingColumnIdentity({ field: 'account', name: 'account_name' })).toBe(true);
    expect(hasConflictingColumnIdentity({ name: 'a', fieldName: 'b' })).toBe(true);
  });

  it('does not flag agreeing or single-key columns', () => {
    expect(hasConflictingColumnIdentity({ field: 'account', name: 'account' })).toBe(false);
    expect(hasConflictingColumnIdentity({ field: 'account' })).toBe(false);
    expect(hasConflictingColumnIdentity({ name: 'account' })).toBe(false);
    expect(hasConflictingColumnIdentity({})).toBe(false);
  });

  it('ignores the adapter key when judging conflict', () => {
    expect(hasConflictingColumnIdentity({ accessorKey: 'x', field: 'account' })).toBe(false);
  });
});

describe('normalizeColumnIdentity (#3104)', () => {
  it('stamps the canonical key from a legacy-only column', () => {
    expect(normalizeColumnIdentity({ name: 'stage' })).toEqual({ field: 'stage', name: 'stage' });
    expect(normalizeColumnIdentity({ fieldName: 'stage' }))
      .toEqual({ field: 'stage', fieldName: 'stage' });
  });

  it('mirrors a disagreeing legacy key onto the canonical identity', () => {
    expect(normalizeColumnIdentity({ field: 'account', name: 'account_name' }))
      .toEqual({ field: 'account', name: 'account' });
  });

  it('never invents a legacy key that was not already there', () => {
    // The fold retires the legacy vocabulary; manufacturing it would be the
    // opposite of the point. A spec-clean column comes back BY REFERENCE.
    const column = { field: 'stage', label: 'Stage' };
    expect(normalizeColumnIdentity(column)).toBe(column);
    expect(normalizeColumnIdentity(column)).not.toHaveProperty('name');
  });

  it('preserves every other key on the column', () => {
    expect(normalizeColumnIdentity({ name: 'stage', label: 'Stage', width: 120, sortable: true }))
      .toEqual({ field: 'stage', name: 'stage', label: 'Stage', width: 120, sortable: true });
  });

  it('leaves the TanStack adapter key untouched', () => {
    expect(normalizeColumnIdentity({ accessorKey: 'stage', name: 'other' }))
      .toEqual({ accessorKey: 'stage', field: 'other', name: 'other' });
  });

  it('passes strings and unresolvable entries through by reference', () => {
    expect(normalizeColumnIdentity('stage')).toBe('stage');
    const empty = {};
    expect(normalizeColumnIdentity(empty)).toBe(empty);
  });

  it('does not mutate its input', () => {
    const column = { field: 'account', name: 'account_name' };
    normalizeColumnIdentity(column);
    expect(column).toEqual({ field: 'account', name: 'account_name' });
  });

  it('is idempotent', () => {
    const once = normalizeColumnIdentity({ field: 'account', name: 'account_name' });
    expect(normalizeColumnIdentity(once)).toBe(once);
  });
});

describe('normalizeColumnIdentities (#3104)', () => {
  it('folds every entry that needs it', () => {
    expect(normalizeColumnIdentities([
      'stage',
      { field: 'account', name: 'account_name' },
      { name: 'owner' },
    ])).toEqual([
      'stage',
      { field: 'account', name: 'account' },
      { field: 'owner', name: 'owner' },
    ]);
  });

  it('returns the input array by reference when nothing needs folding', () => {
    // ListView's downstream `useMemo`s depend on this: a new array identity on
    // the already-canonical path would re-render the whole grid every pass.
    const columns = ['stage', { field: 'account' }];
    expect(normalizeColumnIdentities(columns)).toBe(columns);
  });

  it('passes non-arrays through', () => {
    expect(normalizeColumnIdentities(undefined)).toBeUndefined();
    expect(normalizeColumnIdentities('stage')).toBe('stage');
  });

  it('exposes the key vocabulary it folds', () => {
    expect(CANONICAL_COLUMN_IDENTITY_KEY).toBe('field');
    expect(LEGACY_COLUMN_IDENTITY_KEYS).toEqual(['name', 'fieldName']);
  });
});

describe('normalizeListViewSchema — column identity fold (#3104)', () => {
  const columnsOf = (schema: unknown) =>
    (schema as Record<string, unknown>).columns as unknown[];

  it('canonicalizes the identities of `columns`', () => {
    const out = normalizeListViewSchema({
      viewType: 'grid',
      columns: [{ field: 'account', name: 'account_name' }, { name: 'owner' }],
    });
    expect(columnsOf(out)).toEqual([
      { field: 'account', name: 'account' },
      { field: 'owner', name: 'owner' },
    ]);
  });

  it('runs AFTER the legacy `fields` → `columns` rename', () => {
    // A view can be legacy on both axes at once: legacy list key AND legacy
    // entry key. One pass has to fix both or the entries stay unresolvable.
    const out = normalizeListViewSchema({ viewType: 'grid', fields: [{ name: 'owner' }] });
    expect(columnsOf(out)).toEqual([{ field: 'owner', name: 'owner' }]);
    expect(out).not.toHaveProperty('fields');
  });

  it('still returns the schema by reference when there is nothing to fold', () => {
    const schema = { type: 'list-view', viewType: 'grid', columns: [{ field: 'account' }] };
    expect(normalizeListViewSchema(schema)).toBe(schema);
  });

  it('does not mutate the input schema', () => {
    const columns = [{ field: 'account', name: 'account_name' }];
    const schema = { viewType: 'grid', columns };
    normalizeListViewSchema(schema);
    expect(columns).toEqual([{ field: 'account', name: 'account_name' }]);
  });

  it('is idempotent', () => {
    const once = normalizeListViewSchema({
      viewType: 'grid',
      columns: [{ field: 'account', name: 'account_name' }],
    });
    expect(normalizeListViewSchema(once)).toBe(once);
  });

  it('leaves string columns alone', () => {
    const schema = { viewType: 'grid', columns: ['name', 'stage'] };
    expect(normalizeListViewSchema(schema)).toBe(schema);
  });
});
