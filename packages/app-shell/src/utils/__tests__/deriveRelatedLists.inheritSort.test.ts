/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5795 — a derived related list inherits the CHILD object's default
 * list view `sort`.
 *
 * Ruled on objectstack#11345 (maintainer, 2026-08-23 15:02Z) as **direction
 * 1**: inherit the child's list-view sort, and add **no** new spec key — the
 * field-level `relatedListSort` the issue also offered was explicitly not
 * approved. So there is nothing new to author: the ordering a child object
 * already declares for its own list is the ordering its related lists use,
 * exactly as `columns` already defaults to that list's columns.
 *
 * ## The dialect trap this file exists to pin
 *
 * `ListView.sort` and `record:related_list.sort` declare the SAME union
 * (`string | Array<{field, order}>`) and mean DIFFERENT things by the string
 * arm:
 *
 *   - ListView's string is the legacy space-separated clause, `'seq_no desc'`
 *     (`@objectstack/spec` `ui/view.zod.ts`, annotated `Legacy "field desc"`);
 *   - the related list's own `normalizeSortSpec` (`plugin-detail/RelatedList
 *     .tsx`) reads the OData-ish `'field'` / `'-field'`.
 *
 * Inheriting the string verbatim therefore does not produce "a sort in another
 * notation" — it produces `$orderby` on a field whose NAME is the seven
 * characters `seq_no desc`, which no object has. The route taken (and pinned
 * below) is to normalize at this boundary, always to the ARRAY arm, through
 * `@object-ui/core`'s `convertSortToQueryParams` — the repo's one definition of
 * both authored dialects — so no second parser of the legacy string exists to
 * drift from it.
 *
 * `deriveRelatedLists` is the ONE place that knows it is reading a ListView and
 * writing a related list, which is why the translation belongs here and not as
 * a tolerant reader on the consuming end (AGENTS.md #0.1).
 */

import { describe, it, expect } from 'vitest';
import { deriveRelatedLists } from '../deriveRelatedLists';

const PARENT = { name: 'task_version', label: 'Task Version', fields: {} };

/**
 * Shaped after the issue's downstream case: a "task version" owns "check
 * items" that carry an explicit `seq_no` (10/20/30/40), which rendered in
 * record-id order because the derivation emitted no `sort` at all.
 */
const childWithList = (list: unknown) => ({
  name: 'check_item',
  label: 'Check Item',
  ...(list === undefined ? {} : { list }),
  fields: {
    seq_no: { type: 'number', label: 'Seq No' },
    task_version: { type: 'master_detail', reference_to: 'task_version', label: 'Task Version' },
  },
});

const derive = (child: unknown) =>
  deriveRelatedLists(PARENT, [PARENT, child as any])[0];

describe('deriveRelatedLists — inherited default list-view sort (objectui#5795)', () => {
  it('SUBJECT — inherits the array arm of the child list view sort', () => {
    const entry = derive(childWithList({ sort: [{ field: 'seq_no', order: 'asc' }] }));
    expect(entry.childObject).toBe('check_item');
    expect(entry.sort).toEqual([{ field: 'seq_no', order: 'asc' }]);
  });

  it('preserves a multi-key authored order, in the order authored', () => {
    // Key order matters and survives the map round-trip inside the
    // normalizer because every ObjectStack field name matches
    // `^[a-z_][a-z0-9_]*$` — none is an integer-like key JS would hoist.
    const entry = derive(
      childWithList({
        sort: [
          { field: 'stage', order: 'desc' },
          { field: 'seq_no', order: 'asc' },
        ],
      }),
    );
    expect(entry.sort).toEqual([
      { field: 'stage', order: 'desc' },
      { field: 'seq_no', order: 'asc' },
    ]);
  });

  it('THE DIALECT PIN — normalizes the legacy space-separated string arm', () => {
    const entry = derive(childWithList({ sort: 'seq_no desc' }));
    expect(entry.sort).toEqual([{ field: 'seq_no', order: 'desc' }]);
    // Stated as its own assertion because it is the whole failure mode: an
    // un-normalized inherit yields a FIELD literally named `seq_no desc`.
    expect(entry.sort?.[0].field).toBe('seq_no');
    expect(entry.sort?.[0].field).not.toBe('seq_no desc');
  });

  it('reads a bare legacy string as ascending', () => {
    expect(derive(childWithList({ sort: 'seq_no' })).sort).toEqual([
      { field: 'seq_no', order: 'asc' },
    ]);
  });

  it('is case-insensitive about the legacy direction word', () => {
    expect(derive(childWithList({ sort: 'seq_no DESC' })).sort).toEqual([
      { field: 'seq_no', order: 'desc' },
    ]);
  });

  it('COUNTER-PROBE — a child with no list-view sort gains no `sort` key at all', () => {
    // Not `[]`, not `undefined`-valued: the key is ABSENT, so the synthesized
    // node stays byte-identical to what it was before this inheritance
    // existed. Were it present-and-empty, "inherited nothing" and "inherited
    // an order" would be indistinguishable downstream — and inheritance would
    // be satisfiable by inventing an order.
    for (const list of [undefined, {}, { sort: undefined }, { sort: '' }, { sort: [] }]) {
      const entry = derive(childWithList(list));
      expect(entry.childObject).toBe('check_item');
      expect('sort' in entry).toBe(false);
    }
  });

  it('COUNTER-PROBE — an unusable `sort` is dropped, never guessed at', () => {
    for (const sort of [42, { field: 'seq_no' }, ['seq_no'], [{ order: 'desc' }], null]) {
      expect('sort' in derive(childWithList({ sort }))).toBe(false);
    }
  });

  it('applies the same inherited order to EVERY related list of that child', () => {
    // A child may point at one parent through several FKs; each surfaces as
    // its own list, and all of them list the same object, so all inherit the
    // same declared order.
    const child = {
      name: 'check_item',
      label: 'Check Item',
      list: { sort: [{ field: 'seq_no', order: 'asc' }] },
      fields: {
        seq_no: { type: 'number', label: 'Seq No' },
        owner_version: { type: 'master_detail', reference_to: 'task_version', label: 'Owner' },
        review_version: { type: 'lookup', reference_to: 'task_version', label: 'Reviewer' },
      },
    };
    const entries = deriveRelatedLists(PARENT, [PARENT, child as any]);
    expect(entries).toHaveLength(2);
    for (const e of entries) {
      expect(e.sort).toEqual([{ field: 'seq_no', order: 'asc' }]);
    }
  });

  it('leaves an unrelated child list untouched when only one child declares a sort', () => {
    const sorted = childWithList({ sort: [{ field: 'seq_no', order: 'asc' }] });
    const unsorted = {
      name: 'attachment_note',
      label: 'Note',
      fields: {
        task_version: { type: 'lookup', reference_to: 'task_version', label: 'Task Version' },
      },
    };
    const entries = deriveRelatedLists(PARENT, [PARENT, sorted as any, unsorted as any]);
    const byObject = Object.fromEntries(entries.map((e) => [e.childObject, e]));
    expect(byObject.check_item.sort).toEqual([{ field: 'seq_no', order: 'asc' }]);
    expect('sort' in byObject.attachment_note).toBe(false);
  });
});
