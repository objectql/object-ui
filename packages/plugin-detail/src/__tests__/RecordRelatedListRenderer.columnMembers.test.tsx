/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:related_list.columns` — the MEMBER shape the renderer reads
 * (objectui#8068 / objectui#8071).
 *
 * ## Why this key is the exact defect objectui#8068 was built for
 *
 * The registration declares `{ name: 'columns', type: 'array', of: 'string' }`
 * — members are STRINGS — and the renderer reads them as objects in four more
 * spellings. That is the `page:header.actions` / objectstack#11592 shape word
 * for word: a declaration that says `of: 'string'` while the code folds
 * `{ field }`, `{ name }`, `{ fieldName }` and `{ key }`. `of` carries a member
 * KIND and nothing finer (objectui#8067), so nothing in the published surface
 * can state the union — which is why it is pinned here, against the read site.
 *
 * ## The read site this file drives
 *
 * `renderers/record-related-list.tsx`'s `colName`:
 *
 *     columnIdentity(entry) || (entry && typeof entry === 'object' ? entry.key : null) || null
 *
 * and it runs over EVERY member whenever the block filters columns. That fold
 * is the block's own member read — `columnIdentity` (objectui#3104) supplies
 * the canonical-first `field` / `name` / `fieldName` resolution shared with the
 * rest of the repo, and `key` is a tail fallback this block adds on top.
 *
 * The end-to-end half — an object column reaching the screen with VALUES rather
 * than a header over blank cells — is pinned next door in
 * `RelatedList.columnIdentityAccessor.test.tsx` (objectui#5022), which renders
 * the real `data-table`. This file pins the BLOCK's fold, which that file
 * cannot see: it drives `RelatedList` directly and never runs `colName`.
 *
 * ## ⚠️ The probe key, stated rather than smuggled
 *
 * `redactFields` is the channel used below, because the block folds members
 * ONLY when it filters — with nothing to filter, `columns` is handed down by
 * reference and no member is ever read. `redactFields` and
 * `enforceFieldSecurity` are renderer-only keys: measured against
 * `RecordRelatedListProps` (`@objectstack/spec`), whose top-level keys are
 * actions/add/aria/columns/filter/limit/objectName/relationshipField/
 * relationshipValueField/showViewAll/sort/title, they are on NEITHER the spec
 * nor this block's `inputs`. They are used here as an instrument for a fold
 * that is otherwise unobservable, never as evidence that they are an authoring
 * surface — the first assertion below states that so a later reader cannot take
 * this file as licensing them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { RecordContextProvider } from '@object-ui/react';
import { ComponentRegistry, columnIdentity } from '@object-ui/core';
import { RecordRelatedListRenderer } from '../renderers/record-related-list';
import '../index';

// Capture the column array the BLOCK hands down — the output of its own fold.
const h = vi.hoisted(() => ({ captured: null as any }));
vi.mock('../RelatedList', () => ({
  RelatedList: (props: any) => {
    h.captured = props;
    return <div data-testid="related-list" />;
  },
}));

const makeDS = () => ({
  find: vi.fn(async () => []),
  getObjectSchema: vi.fn(async (name: string) => ({ name, fields: {} })),
});

/** Render the block with only `columns` (and the redact probe) varying. */
async function columnsAfterFold(columns: unknown[], redactFields?: string[]): Promise<any[]> {
  // Unmount whatever a previous call in this test mounted, and clear the
  // capture, so `waitFor` below can never resolve on the PREVIOUS render's
  // props — several cases here render twice and compare the two results.
  cleanup();
  h.captured = null;
  render(
    <RecordContextProvider objectName="account" recordId="ACC-1" dataSource={makeDS() as any}>
      <RecordRelatedListRenderer
        schema={
          {
            objectName: 'contact',
            relationshipField: 'account',
            columns,
            ...(redactFields ? { redactFields } : {}),
          } as any
        }
      />
    </RecordContextProvider>,
  );
  await waitFor(() => expect(h.captured).toBeTruthy());
  return h.captured.columns;
}

/**
 * Does the block resolve this member to the identity `status`? Measured by
 * redacting `status` and seeing the member go — with the CONTROL in the same
 * call, so a member that vanished for any other reason cannot read as a
 * resolution.
 */
async function resolvesToStatus(member: unknown): Promise<boolean> {
  const kept = await columnsAfterFold([member], ['some_other_field']);
  expect(kept, 'control: the member survives when a DIFFERENT field is redacted').toEqual([member]);
  h.captured = null;
  const dropped = await columnsAfterFold([member], ['status']);
  return dropped.length === 0;
}

const input = (name: string) =>
  ComponentRegistry.getConfig('record:related_list')?.inputs?.find((i) => i.name === name);

beforeEach(() => {
  h.captured = null;
});

describe('record:related_list — the `columns` MEMBER shape the renderer reads (objectui#8068)', () => {
  it('THE HOLE — the declaration says members are STRINGS, and the code reads objects', () => {
    // Both halves in one assertion, because the pin is the GAP between them and
    // either half alone is unremarkable. If a later change makes the declaration
    // honest, this reddens and the pins below must be re-read rather than
    // assumed still current.
    expect(input('columns')?.type).toBe('array');
    expect(input('columns')?.of).toBe('string');
    // …and the shared resolver this block folds through accepts object members.
    expect(columnIdentity({ field: 'status' })).toBe('status');
  });

  it('resolves the spec-canonical `{ field }` member', async () => {
    expect(await resolvesToStatus({ field: 'status', label: 'Status' })).toBe(true);
  });

  it('resolves the legacy `{ name }` and `{ fieldName }` members', async () => {
    // objectui-side legacy that stored host metadata can still carry; the fold
    // accepts them and the identity ratchet counts them.
    expect(await resolvesToStatus({ name: 'status' })).toBe(true);
    h.captured = null;
    expect(await resolvesToStatus({ fieldName: 'status' })).toBe(true);
  });

  it('resolves a bare STRING member — the one shape the declaration admits', async () => {
    expect(await resolvesToStatus('status')).toBe(true);
  });

  it("resolves `{ key }`, a tail fallback that is THIS BLOCK's alone", async () => {
    // The member spelling the shared resolver deliberately refuses: `key` is a
    // generic entry key, not ObjectStack metadata identity (objectui#3104), so
    // `columnIdentity` returns undefined for it and `colName` adds it after.
    // Both halves asserted, because "the block resolves it" and "the shared
    // resolver does not" is the whole content of "tail fallback".
    expect(columnIdentity({ key: 'status' })).toBeUndefined();
    expect(await resolvesToStatus({ key: 'status' })).toBe(true);
  });

  it('is canonical-FIRST — `field` wins over a disagreeing `name`', async () => {
    // A mixed-key member is the shape that makes the renderer and the data
    // request resolve two different fields. Both directions, because a fold
    // that read only `name` would satisfy a one-sided assertion.
    const mixed = { field: 'status', name: 'subject' };
    expect(await columnsAfterFold([mixed], ['status'])).toEqual([]);
    h.captured = null;
    expect(await columnsAfterFold([mixed], ['subject'])).toEqual([mixed]);
  });

  it('keeps a member whose identity it cannot resolve, rather than dropping it', async () => {
    // `colName` returns null and the filter's else-branch keeps the entry
    // (`return n ? allowed.has(n) : true`). Pinned because it is the member
    // contract's sharp edge: an entry the fold cannot NAME is an entry the fold
    // cannot filter, so whatever the entry means downstream is unfiltered.
    // `accessorKey` is the concrete instance — the table LIBRARY's own key,
    // excluded from `columnIdentity` on purpose (objectui#3104) and read by
    // `RelatedList` as `c?.accessorKey || columnIdentity(c)`. So a column
    // authored that way is kept by this fold AND rendered by the table: filed
    // as objectui#8793. Pinned as the CURRENT behaviour it is, which means this
    // row reds when that lands — deliberately, so the fix cannot be quiet.
    expect(columnIdentity({ accessorKey: 'status' })).toBeUndefined();
    expect(await columnsAfterFold([{ accessorKey: 'status' }], ['status'])).toEqual([
      { accessorKey: 'status' },
    ]);
  });

  it('folds a MIXED-spelling column set member by member, not all-or-nothing', async () => {
    // Non-vacuity for the whole file: every case above uses a single-member
    // array, which a fold that returned its input unchanged would also satisfy
    // for the "kept" half. Here the array must come back SHORTER and in order.
    const set = ['subject', { field: 'status' }, { name: 'owner' }];
    expect(await columnsAfterFold(set, ['status'])).toEqual(['subject', { name: 'owner' }]);
  });

  it('COUNTER-PROBE — with nothing redacted the array is handed down untouched', async () => {
    // The fold only runs when the block filters. Stated so the instrument's
    // limits are on the record: with no `redactFields` and no
    // `enforceFieldSecurity`, no member is read at all and this pin's read site
    // never executes.
    const set = ['subject', { field: 'status' }];
    expect(await columnsAfterFold(set)).toEqual(set);
  });

  it('CONTROL — `redactFields` is an instrument here, not an authoring surface', async () => {
    // See the file docblock. The block's published `inputs` do not declare it,
    // and this assertion is what stops a later reader citing this file as
    // evidence that it is declared.
    expect(input('redactFields')).toBeUndefined();
    expect(input('enforceFieldSecurity')).toBeUndefined();
  });
});
