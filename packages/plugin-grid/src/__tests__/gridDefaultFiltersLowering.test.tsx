/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-grid` — the LEGACY `defaultFilters` leg must reach `$filter` through
 * the same lowering sink as the canonical `filter` key (objectui#4082).
 *
 * ## What was wrong
 *
 * objectui#4041 converged the declared `filter` key onto `toFilterNode`, the
 * repo's single "last hop before the wire". The legacy branch sitting directly
 * beside it was left assigning byte-for-byte:
 *
 *   if (schemaFilter !== undefined) {
 *     params.$filter = schemaFilter;            // lowered
 *   } else if (schema.defaultFilters) {
 *     params.$filter = schema.defaultFilters;   // NOT lowered
 *   }
 *
 * That made this the one leg on the chain reaching the wire unlowered —
 * `plugin-list`'s `buildEffectiveFilter` and `plugin-view`'s non-grid fetch
 * both already route the same value through `toFilterNode`/`mergeFilterNodes`.
 *
 * `isFilterAST` refuses BOTH shapes this slot carries, so either one sent raw
 * is the `400 INVALID_FILTER` measured against a real backend in
 * objectui#3431:
 *
 *   - the declared `Record<string, any>` (MongoDB-style) — a plain OBJECT
 *     where the wire expects an AST node;
 *   - a `ViewFilterRule[]` — an array of rule OBJECTS, which `plugin-view`
 *     forwards into this slot for an active named view (`ObjectView.tsx`, the
 *     `gridSchema` memo: `defaultFilters: viewFilter || …`).
 *
 * The second one is why this is not purely dormant. The card was filed on "no
 * measured producer", reasoning that `defaultFilters` is not in `object-grid`'s
 * registered `inputs` so an author writing it only draws a save-gate warning.
 * That covers authors, not the framework: `plugin-view`'s README documents
 * `listViews.<name>.filter` as `[{ field, operator, value }, …]`, and the
 * registered `object-view` renderer passes no `renderListView`, so that path
 * falls through to `ObjectGrid` rather than to `ListView`.
 *
 * ## What these tests pin
 *
 * That the legacy slot is lowered — the assertion is `$filter` carrying AST,
 * never merely `$filter` being present, for the same reason the sibling
 * `gridFilterInputSpelling.test.tsx` states: "it arrived" and "it arrived in a
 * shape the server accepts" are different claims, and only the second is worth
 * anything here.
 *
 * And two NEGATIVE CONTROLS, which are the half that would rot silently:
 *
 *   1. the canonical `filter` path is untouched — it still wins over the
 *      legacy slot, and its own lowering / pass-through / empty-fold behaviour
 *      is unchanged;
 *   2. an already-AST value in the legacy slot is NOT lowered a second time.
 *      A sink applied twice is the mirror-image defect of a sink not applied,
 *      and it is what a careless "just wrap it in toFilterNode" would produce.
 *
 * ## Reverse verification (prediction recorded BEFORE the run)
 *
 * Restoring the raw assignment (`} else if (schema.defaultFilters) { params.
 * $filter = schema.defaultFilters; }`) was predicted to move exactly three
 * cases and no others:
 *
 *   RED   — the `Record` case (`$filter` arrives as the plain object)
 *   RED   — the `ViewFilterRule[]` case (`$filter` arrives as rule objects)
 *   RED   — the empty-object case (`$filter` arrives as `{}` rather than absent)
 *   GREEN — every already-AST case, both slots: the pre-fix code passed AST
 *           through verbatim too, so a control that MOVED here would mean the
 *           change double-lowers rather than that it works
 *   GREEN — every canonical-`filter` case: the change does not touch that branch
 *
 * "Everything turns red" would have been the wrong outcome, not a stronger
 * one — it would say the controls are not controls. Observed result is
 * recorded on the PR.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `object-grid` and its `view:grid` alias.
import '../index';

function makeAdapter() {
  return {
    find: vi.fn().mockResolvedValue({
      data: [{ id: '1', name: 'Acme', status: 'active', stage: 'won' }],
      total: 1,
    }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'account',
      fields: {
        id: { type: 'text' },
        name: { type: 'text' },
        status: { type: 'text' },
        stage: { type: 'text' },
        amount: { type: 'number' },
      },
    }),
  };
}

/**
 * Render the block and return the params of its first `find` call.
 *
 * Deliberately the SAME harness shape as `gridFilterInputSpelling.test.tsx`,
 * so the canonical and legacy spellings are observed through one lens — the
 * whole subject here is that the two legs disagreed.
 */
async function findParamsFor(schema: Record<string, unknown>) {
  const adapter = makeAdapter();
  render(
    <SchemaRendererProvider dataSource={adapter as any}>
      <SchemaRenderer schema={schema as any} />
    </SchemaRendererProvider>,
  );
  await waitFor(() => expect(adapter.find).toHaveBeenCalled());
  return (adapter.find.mock.calls[0] as [string, any])[1];
}

const BASE = { type: 'object-grid', objectName: 'account', columns: [{ field: 'name' }] };

describe('object-grid — legacy `defaultFilters` is lowered before the wire (objectui#4082)', () => {
  it('lowers the declared `Record<string, any>` shape to AST', async () => {
    // The shape the key is actually DECLARED as
    // (`packages/types/src/objectql.ts:682`). `isFilterAST` is false for a
    // plain object, so this is the case that used to guarantee a 400.
    const params = await findParamsFor({ ...BASE, defaultFilters: { status: 'active' } });
    expect(params.$filter).toEqual(['status', '=', 'active']);
  });

  it('folds a multi-key `Record` into a single `and` node', async () => {
    const params = await findParamsFor({
      ...BASE,
      defaultFilters: { status: 'active', stage: 'won' },
    });
    expect(params.$filter).toEqual(['and', ['status', '=', 'active'], ['stage', '=', 'won']]);
  });

  it('lowers the `ViewFilterRule[]` shape `plugin-view` forwards into this slot', async () => {
    // Not a hypothetical shape: `ObjectView`'s `gridSchema` memo assigns
    // `defaultFilters: viewFilter || schema.table?.defaultFilters`, where
    // `viewFilter` is an active named view's `filter`. `plugin-view`'s README
    // documents that as `[{ field, operator, value }, …]`, and the showcase
    // ships exactly this value on `showcase_task.in_progress`.
    const params = await findParamsFor({
      ...BASE,
      defaultFilters: [
        { field: 'status', operator: 'equals', value: 'in_progress' },
      ] as unknown as Record<string, unknown>,
    });
    expect(params.$filter).toEqual([['status', 'equals', 'in_progress']]);
    // Stated structurally too: no bare rule OBJECT may survive into the
    // outgoing filter, whichever slot it arrived in.
    for (const node of params.$filter as unknown[]) {
      expect(Array.isArray(node)).toBe(true);
    }
  });

  it('omits `$filter` for an empty `defaultFilters` rather than sending `{}`', async () => {
    // The truthiness guard this replaces let `{}` through, so the grid asked
    // the server a question with no content — in a shape it refuses. Same
    // contract the canonical key already honours for `filter: []`.
    const params = await findParamsFor({ ...BASE, defaultFilters: {} });
    expect(params.$filter).toBeUndefined();
  });

  it('omits `$filter` when neither slot is written', async () => {
    const params = await findParamsFor({ ...BASE });
    expect(params.$filter).toBeUndefined();
  });
});

describe('object-grid — NEGATIVE CONTROL: no double lowering (objectui#4082)', () => {
  it('leaves an already-composed AST in the legacy slot byte-identical', async () => {
    // `toFilterNode` passes AST through untouched, and this pins that it still
    // does from THIS slot. A second lowering pass is the mirror-image defect of
    // the one being fixed, and this case is the one that would catch it.
    const ast = ['and', ['stage', '=', 'won'], ['amount', '>', 100]];
    const params = await findParamsFor({
      ...BASE,
      defaultFilters: ast as unknown as Record<string, unknown>,
    });
    expect(params.$filter).toEqual(['and', ['stage', '=', 'won'], ['amount', '>', 100]]);
  });

  it('leaves a flat array of AST nodes in the legacy slot byte-identical', async () => {
    const params = await findParamsFor({
      ...BASE,
      defaultFilters: [['status', '=', 'active']] as unknown as Record<string, unknown>,
    });
    expect(params.$filter).toEqual([['status', '=', 'active']]);
    // Structural, not just deep-equal: an AST that came back "equal" after
    // being rebuilt would still be a lowering pass that should not have run.
    expect((params.$filter as unknown[]).every((n) => Array.isArray(n))).toBe(true);
  });
});

describe('object-grid — NEGATIVE CONTROL: the declared `filter` path is unchanged (objectui#4082)', () => {
  it('still prefers the canonical `filter` over the legacy slot', async () => {
    // Precedence is the part a "fix" here could most easily invert. The
    // canonical key wins; the legacy value must not appear at all.
    const params = await findParamsFor({
      ...BASE,
      filter: [['stage', '=', 'won']],
      defaultFilters: { status: 'active' },
    });
    expect(params.$filter).toEqual([['stage', '=', 'won']]);
  });

  it('still prefers the canonical `filter` even when the legacy slot is richer', async () => {
    const params = await findParamsFor({
      ...BASE,
      filter: [{ field: 'stage', operator: 'equals', value: 'won' }],
      defaultFilters: { status: 'active', amount: { $gt: 100 } },
    });
    expect(params.$filter).toEqual([['stage', 'equals', 'won']]);
  });

  it('falls back to the legacy slot only when the canonical one folds away', async () => {
    // `filter: []` folds to `undefined`, which is "no filter declared" — so the
    // legacy slot is reached, and reached LOWERED. This is the seam between the
    // two branches, and it is the one place the change could have altered which
    // branch runs.
    const params = await findParamsFor({
      ...BASE,
      filter: [],
      defaultFilters: { status: 'active' },
    });
    expect(params.$filter).toEqual(['status', '=', 'active']);
  });

  it('still lowers the canonical `filter` itself', async () => {
    const params = await findParamsFor({
      ...BASE,
      filter: [{ field: 'stage', operator: 'equals', value: 'won' }],
    });
    expect(params.$filter).toEqual([['stage', 'equals', 'won']]);
  });

  it('still passes an already-composed canonical AST through untouched', async () => {
    const params = await findParamsFor({
      ...BASE,
      filter: ['and', ['stage', '=', 'won'], ['amount', '>', 100]],
    });
    expect(params.$filter).toEqual(['and', ['stage', '=', 'won'], ['amount', '>', 100]]);
  });

  it('still omits `$filter` for a declared-but-empty canonical filter', async () => {
    const params = await findParamsFor({ ...BASE, filter: [] });
    expect(params.$filter).toBeUndefined();
  });
});

describe('object-grid — the legacy `defaultSort` leg is NOT filter-lowered (objectui#4082)', () => {
  it('sends `defaultSort` as the declared `$orderby` clause string, untouched', async () => {
    // The sibling leg triage asked to grade with this one. It feeds `$orderby`,
    // not `$filter`, and `"field order"` is a DECLARED-accepted `$orderby`
    // shape (`packages/types/src/data.ts:63`, `@example 'name asc'`) — so
    // there is no un-lowered hazard to close, and `toFilterNode` (which
    // returns a FILTER AST) does not belong on it. Pinned so a later pass
    // cannot pattern-match the filter fix onto sort.
    const params = await findParamsFor({
      ...BASE,
      defaultSort: { field: 'name', order: 'desc' } as unknown as Record<string, unknown>,
    });
    expect(params.$orderby).toBe('name desc');
    expect(params.$filter).toBeUndefined();
  });

  it('keeps the canonical `sort` emitting the SAME clause-string vocabulary', async () => {
    // The reason there is no asymmetry to fix: unlike filter — where canonical
    // is lowered and legacy was raw — both sort legs emit the identical shape.
    const params = await findParamsFor({
      ...BASE,
      sort: [{ field: 'name', order: 'desc' }],
    });
    expect(params.$orderby).toBe('name desc');
  });
});
