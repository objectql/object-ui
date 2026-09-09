/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `element:record_picker.sort` — the MEMBER shape the renderer reads
 * (objectui#8068 / objectui#8071 slice 3).
 *
 * The registration declares `{ name: 'sort', type: 'array', of: 'object' }` —
 * `of` names a coarse MEMBER KIND and nothing finer (objectui#8067) — so the
 * published surface says "an array of objects" and stops there. What actually
 * reaches the wire is answered here, against the read site, not restated from
 * the declaration.
 *
 * ## Where the read happens, and why it is an IDENTITY pin
 *
 * `record-picker.tsx`:
 *
 *     const sort = composed?.sort ?? props.sort;
 *     …
 *     if (sort) query.$orderby = sort;
 *
 * There is no `normalizeSortSpec` here, unlike `record:related_list.sort`
 * (objectui#8071 slice 2) — the array authored on `sort` is assigned to
 * `$orderby` BY REFERENCE, unfiltered and untransformed. That is the sharp edge
 * this file exists to pin: a malformed member (missing `field`) is NOT dropped
 * the way the sibling block drops one, because nothing here inspects a member
 * at all. Declaring `of: 'object'` says a member is an object; it says nothing
 * about whether the renderer looks inside one, and for this block it does not.
 *
 * ## The other half — precedence against `dataSource`
 *
 * Identical to `filter`'s PRECEDENCE, stated in that key's own description:
 * `composed?.sort ?? props.sort`, so a node-level `dataSource` binding (or the
 * saved view its `view` names) REPLACES this key outright rather than merging
 * with it, and the flat key applies only when the node carries no `dataSource`,
 * or that `dataSource` and its view both leave `sort` unset
 * (`composeElementDataSource`: `config.sort ?? view?.sort`). Both directions are
 * pinned, because a renderer that always preferred one source would satisfy
 * only one of them.
 *
 * No adapter's `getObjectSchema` is needed: every case below either omits
 * `dataSource` or names no `view`, so the saved-view fetch never engages —
 * matching the disposition `record-picker-element-data-source.test.tsx` already
 * established for the `view`-bearing cases of this same block.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { AdapterCtx, SchemaRenderer } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';
// Registers `element:record_picker` at module scope, not in a hook
// (object-ui/no-dynamic-import-in-test-hook, objectui#3010).
import '../renderers';

const makeAdapter = () => ({
  find: vi.fn().mockResolvedValue({ data: [] }),
  getObjectSchema: vi.fn(),
});

/**
 * `object` / `filter` / `sort` / `limit` / `label` / `placeholder` live under
 * `schema.properties` (the spec's element config bag, `readProps` above); the
 * per-element `dataSource` BINDING is a sibling top-level schema key, read
 * directly off `schema.dataSource` by `useElementDataSource`. Getting the two
 * confused is the one mistake that would make every case below fetch nothing.
 */
const renderPicker = (
  properties: Record<string, unknown>,
  adapter: ReturnType<typeof makeAdapter>,
  dataSource?: Record<string, unknown>,
) =>
  render(
    <AdapterCtx.Provider value={adapter as any}>
      <SchemaRenderer
        schema={
          {
            type: 'element:record_picker',
            id: 'picker',
            properties,
            ...(dataSource ? { dataSource } : {}),
          } as any
        }
      />
    </AdapterCtx.Provider>,
  );

/** The `$orderby` this block put on the wire, or `undefined` when it sent none. */
async function orderbyOf(
  properties: Record<string, unknown>,
  dataSource?: Record<string, unknown>,
): Promise<unknown> {
  const adapter = makeAdapter();
  renderPicker({ object: 'account', ...properties }, adapter, dataSource);
  await waitFor(() => expect(adapter.find).toHaveBeenCalled());
  return (adapter.find.mock.calls[0] as any[])[1].$orderby;
}

const input = (name: string) =>
  ComponentRegistry.getConfig('element:record_picker')?.inputs?.find((i) => i.name === name);

describe('element:record_picker — the `sort` MEMBER shape the renderer reads (objectui#8068)', () => {
  it('CONTROL — sort is declared as an array of OBJECTS, and the declaration stops there', () => {
    // Calibration for everything below: this pin exists BECAUSE the published
    // surface names the member kind and nothing else. If a future change adds a
    // description or narrows `of`, this stays true — it is the read site below
    // that would then need re-reading, not this row.
    expect(input('sort')).toBeDefined();
    expect(input('sort')?.type).toBe('array');
    expect(input('sort')?.of).toBe('object');
  });

  it('SUBJECT — an authored array reaches $orderby BY IDENTITY, not a copy', async () => {
    // `toBe`, not `toEqual`: `query.$orderby = sort` is a reference assignment,
    // so a fix that started cloning or lowering the array would turn this red
    // even though `toEqual` would still pass.
    const sort = [{ field: 'name', order: 'asc' }];
    const adapter = makeAdapter();
    renderPicker({ object: 'account', sort }, adapter);
    await waitFor(() => expect(adapter.find).toHaveBeenCalled());
    expect((adapter.find.mock.calls[0] as any[])[1].$orderby).toBe(sort);
  });

  it('resolves the flat `object` shorthand the same way (reachability before absence)', async () => {
    // Without this, every case below that never checks `object` reaching the
    // query could be satisfied by a picker that never queried at all.
    const adapter = makeAdapter();
    renderPicker({ object: 'account' }, adapter);
    await waitFor(() => expect(adapter.find).toHaveBeenCalledWith('account', expect.any(Object)));
  });

  it('keeps multi-member order, in the order authored', async () => {
    // A reader who only saw the identity assertion above could still believe a
    // reordering read the "same" array. This is the row that would catch it.
    const sort = [
      { field: 'stage', order: 'asc' },
      { field: 'created', order: 'desc' },
    ];
    expect(await orderbyOf({ sort })).toEqual(sort);
  });

  it("passes a member missing `field` through UNFILTERED — the block does NOT drop it", async () => {
    // The declared behavioural difference from `record:related_list.sort`
    // (objectui#8071 slice 2), which drops such a member silently via
    // `normalizeSortSpec`'s `.filter((s) => !!s?.field)`. This block has no
    // equivalent filter, so the malformed member survives alongside its
    // well-formed sibling — pinned as the current behaviour it is, because
    // `of: 'object'` alone gives an author no way to discover which sibling
    // block validates a member and which does not.
    const sort = [{ order: 'desc' }, { field: 'created', order: 'desc' }];
    expect(await orderbyOf({ sort })).toEqual(sort);
  });

  it('sends NO $orderby when `sort` is absent, rather than an empty clause', async () => {
    // Non-vacuity for the identity/order rows above: without this, a renderer
    // that always sent a hard-coded `$orderby` could still satisfy them by
    // coincidence on the one case that names a real array.
    expect(await orderbyOf({})).toBeUndefined();
  });

  it('a `dataSource` binding that declares its own `sort` REPLACES the flat key outright', async () => {
    // PRECEDENCE, direction 1. The flat `sort` is authored too, so a renderer
    // that merged rather than replaced — or that read the flat key first —
    // could not pass this row.
    const dsSort = [{ field: 'amount', order: 'desc' }];
    const flatSort = [{ field: 'name', order: 'asc' }];
    expect(await orderbyOf({ sort: flatSort }, { object: 'account', sort: dsSort })).toBe(dsSort);
  });

  it('the flat `sort` still applies when the `dataSource` binding carries none', async () => {
    // PRECEDENCE, direction 2 — the complement the row above cannot exercise. A
    // `dataSource` is present (so a renderer gating on "dataSource present ⇒
    // ignore the flat key entirely" would fail here), but it names no `sort` and
    // no `view`, so `composed.sort` is `undefined` and `composed?.sort ??
    // props.sort` must fall through to the flat key.
    const flatSort = [{ field: 'name', order: 'asc' }];
    expect(await orderbyOf({ sort: flatSort }, { object: 'account' })).toBe(flatSort);
  });
});
