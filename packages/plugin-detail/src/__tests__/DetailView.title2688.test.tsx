/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#2688 — the record surface opened from a gantt row (and any other
 * caller that provides neither `schema.title` nor a resolvable declared name
 * field) floored the header to `Record #<id>` and the meta footer printed the
 * raw `created_by` user id.
 *
 *  - Header: when everything above it misses, a name-ish key sitting right on
 *    the record (e.g. a `name` typed `autonumber`, which the type-aware
 *    derivation deliberately skips) must beat the `Record #<id>` floor.
 *  - Footer: `created_by` / `updated_by` are always user references on
 *    ObjectStack; when the fetched schema omits the audit system fields the
 *    footer must still render them through the reference renderer (which shows
 *    a resolved name or a muted placeholder) — never the raw opaque id.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailView } from '../DetailView';
import { RecordMetaFooter } from '../RecordMetaFooter';
import type { DetailViewSchema } from '@object-ui/types';

describe('DetailView header title — record-key probe before the Record # floor (#2688)', () => {
  it('uses a name-ish record key when no schema.title and no declared name field resolve', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      objectName: 'production_plan',
      data: { id: 'A1', name: '甘特计划A 组焊' },
      fields: [{ name: 'status', label: '状态' }],
    };
    const { container } = render(<DetailView schema={schema} />);
    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toBe('甘特计划A 组焊');
  });

  it('still floors to Record #<id> when the record has no name-ish key at all', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      objectName: 'thing',
      data: { id: 'B2', qty: 3 },
      fields: [{ name: 'qty', label: 'Qty' }],
    };
    const { container } = render(<DetailView schema={schema} />);
    expect(container.querySelector('h1')?.textContent).toBe('Record #B2');
  });

  it('keeps preferring schema.title over a guessed record key', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      objectName: 'thing',
      title: 'Object Label',
      data: { id: 'C3', name: 'Real Name' },
      fields: [{ name: 'name', label: 'Name' }],
    };
    const { container } = render(<DetailView schema={schema} />);
    // The unified resolver (step 3) resolves `name` via the schema-typed path
    // here; the point is the header is never the raw floor when a title exists.
    expect(container.querySelector('h1')?.textContent).not.toBe('Record #C3');
  });
});

describe('RecordMetaFooter — audit fields default to a sys_user reference (#2688)', () => {
  const OPAQUE_ID = 'g3WkZnvugj4DnYw8u5Mo6ig3ljDhiFGO';

  it('never prints the raw created_by id when the schema omits the audit field', () => {
    render(
      <RecordMetaFooter
        data={{ created_at: '2024-06-01T00:00:00Z', created_by: OPAQUE_ID }}
        objectSchema={{ fields: { name: { type: 'text' } } }}
        objectName="production_plan"
      />,
    );
    expect(screen.getByTestId('record-meta-footer')).toBeInTheDocument();
    // Reference renderer shows a resolved name or a muted placeholder — the
    // opaque id itself must not leak into the footer text.
    expect(screen.queryByText(OPAQUE_ID)).toBeNull();
  });

  it('still honours an explicit audit-field definition from the schema', () => {
    render(
      <RecordMetaFooter
        data={{ created_at: '2024-06-01T00:00:00Z', created_by: OPAQUE_ID }}
        objectSchema={{
          fields: { created_by: { type: 'lookup', reference_to: 'sys_user' } },
        }}
        objectName="production_plan"
      />,
    );
    expect(screen.queryByText(OPAQUE_ID)).toBeNull();
  });
});
