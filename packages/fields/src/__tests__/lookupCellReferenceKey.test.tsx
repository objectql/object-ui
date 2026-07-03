/**
 * Regression: LookupCellRenderer must resolve a bare foreign-key id to a
 * display name when the field metadata carries the ObjectStack `reference`
 * key (as produced by `Field.lookup('...')` in @objectstack/spec) — not only
 * the objectui `reference_to` alias.
 *
 * Real-world symptom (framework app-showcase): inline-edit a lookup cell, pick
 * a record, click another row → the cell showed a muted "—" forever because
 * the just-picked opaque id could not be resolved. Every other reader in the
 * codebase (LookupField, UserField, DetailSection, RelatedList, …) already
 * accepts `reference_to || reference`; this read cell used to read only
 * `reference_to`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { LookupCellRenderer } from '../index';
import { SchemaRendererProvider } from '@object-ui/react';

// A ULID-style id: `isLikelyOpaqueId` returns true for it, so the OLD code
// (which failed to resolve) would fall back to the muted "—" placeholder.
const OPAQUE_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

function makeDataSource() {
  const findOne = vi.fn(async (object: string, id: string) => {
    if (object === 'showcase_account' && id === OPAQUE_ID) {
      return { id, name: 'Globex' };
    }
    return null;
  });
  return { findOne, find: vi.fn() } as any;
}

describe('LookupCellRenderer — reference key resolution', () => {
  it('resolves an opaque id to a name via the `reference` key (not just reference_to)', async () => {
    const ds = makeDataSource();
    render(
      <SchemaRendererProvider dataSource={ds}>
        <LookupCellRenderer
          value={OPAQUE_ID}
          // ObjectStack convention: the lookup target lives under `reference`.
          field={{ type: 'lookup', reference: 'showcase_account' } as any}
        />
      </SchemaRendererProvider>,
    );

    // The related record's display name must appear…
    await waitFor(() => {
      expect(screen.getByText('Globex')).toBeInTheDocument();
    });
    // …and the muted placeholder must NOT be what the user sees.
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(ds.findOne).toHaveBeenCalledWith('showcase_account', OPAQUE_ID);
  });
});
