/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-grid` — the filter written under the DECLARED input name must reach
 * the query (objectui#4041, source thread objectstack#7119).
 *
 * ## What was wrong
 *
 * The registration published plural `filters` while `ObjectGrid` read singular
 * `schema.filter`, and `schema.filters` had zero read points anywhere. Both
 * halves failed quietly, in opposite directions:
 *
 *   - an author following the published vocabulary wrote `filters: [...]`, the
 *     save gate accepted it (`sdui-parser/src/validate.ts` walks a node's props
 *     against `inputs`, and `filters` was there), the renderer never read it,
 *     and the grid answered with the WHOLE TABLE — no error anywhere;
 *   - the spelling that actually worked, `filter`, was not declared, so writing
 *     it was reported as `unknown-prop`.
 *
 * Published vocabulary and runtime read pointed at opposite keys. That is
 * objectstack#4413's shape in the "declaration ≠ read point" variant
 * (objectui#3407).
 *
 * ## What these tests pin
 *
 * The card's pin, and it is deliberately written to read the name OUT of the
 * registry rather than hard-coding `'filter'`: a test that spells the key
 * itself would keep passing if the declaration drifted again, which is exactly
 * the defect. So `declaredFilterInput()` below is the subject, and every
 * behavioural assertion writes its schema under that name.
 *
 * The second pin is the constraint recorded on the source thread: reaching the
 * read point is not enough. An author writes the spec's view vocabulary
 * (`ViewFilterRule[]` — `[{ field, operator, value }]`), and that shape copied
 * byte-for-byte onto `$filter` is refused on the wire (`isFilterAST` is false
 * for an array of objects; the data API answers `400 INVALID_FILTER`, measured
 * against a real backend in objectui#3431). Declaring the key without lowering
 * it through `toFilterNode` would have swapped a silent wrong answer for a
 * guaranteed failure. So the pin is `$filter` carrying LOWERED AST, not merely
 * `$filter` being present.
 *
 * The last one is the historical record the card asked for: the old plural is
 * gone from the declaration, and — asserted behaviourally, not just by absence
 * — a schema written the way the old declaration invited never filtered
 * anything.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `object-grid` and its `view:grid` alias.
import '../index';

/** The two tags this one renderer is published under. */
const GRID_TAGS = [
  { label: 'object-grid', type: 'object-grid', namespace: undefined },
  { label: 'view:grid', type: 'grid', namespace: 'view' },
] as const;

/**
 * The block's declared filter input, read from the registration.
 *
 * The whole defect was a declaration that disagreed with the renderer, so the
 * declaration is the input to these tests, never a constant restated here.
 */
function declaredFilterInput(type: string, namespace?: string) {
  const inputs = (ComponentRegistry.getConfig(type, namespace) as any)?.inputs ?? [];
  return inputs.find((i: any) => /^filters?$/.test(i?.name));
}

function makeAdapter() {
  return {
    find: vi.fn().mockResolvedValue({ data: [{ id: '1', name: 'Acme', stage: 'won' }], total: 1 }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'account',
      fields: { id: { type: 'text' }, name: { type: 'text' }, stage: { type: 'text' } },
    }),
  };
}

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

describe('object-grid filter input — declaration matches the read point (objectui#4041)', () => {
  it.each(GRID_TAGS)('$label declares the filter input in the SINGULAR', ({ type, namespace }) => {
    const input = declaredFilterInput(type, namespace);
    // Not `toBeDefined()` on a hard-coded `'filter'` lookup: the regex above
    // accepts either spelling so this assertion reports WHICH one is published.
    expect(input?.name).toBe('filter');
    expect(input?.type).toBe('array');
  });

  it('declares one spelling across both tags, so the alias cannot drift', () => {
    // The alias is the same renderer, so a second declaration is a second
    // chance to disagree with it. (The third alignment the ruling names — with
    // the sibling `list-view` block — is not asserted from here: `plugin-list`
    // is not a dependency of this package, and adding one for a test would buy
    // the pin with a package edge. It is verified in the PR:
    // `packages/plugin-list/src/index.tsx:52,:93` declare `filter` too.)
    const [a, b] = GRID_TAGS.map(({ type, namespace }) => declaredFilterInput(type, namespace));
    expect(a?.name).toBe(b?.name);
  });

  it('no longer declares the plural `filters` on either tag', () => {
    for (const { type, namespace } of GRID_TAGS) {
      const names = ((ComponentRegistry.getConfig(type, namespace) as any)?.inputs ?? [])
        .map((i: any) => i?.name);
      expect(names).not.toContain('filters');
    }
  });
});

describe('object-grid — the declared name reaches `$filter` (objectui#4041)', () => {
  it.each(GRID_TAGS)(
    '$label sends the filter written under its declared input name',
    async ({ type, namespace }) => {
      const key = declaredFilterInput(type, namespace)!.name;
      const tag = namespace ? `${namespace}:${type}` : type;
      const params = await findParamsFor({
        type: tag,
        objectName: 'account',
        columns: [{ field: 'name' }],
        [key]: [['stage', '=', 'won']],
      });
      // The card's pin, stated exactly: write a filter under the published
      // word, get `$filter` in the query.
      expect(params.$filter).toEqual([['stage', '=', 'won']]);
    },
  );

  it('lowers the spec view vocabulary to AST instead of sending rule objects', async () => {
    // `ViewFilterRule[]` is what a saved view and a spec-following author both
    // write. Sent verbatim the wire face answers `400 INVALID_FILTER`
    // (objectui#3431), so "it arrived" is not the assertion — "it arrived in a
    // shape the server accepts" is.
    const key = declaredFilterInput('object-grid')!.name;
    const params = await findParamsFor({
      type: 'object-grid',
      objectName: 'account',
      columns: [{ field: 'name' }],
      [key]: [{ field: 'stage', operator: 'equals', value: 'won' }],
    });
    expect(params.$filter).toEqual([['stage', 'equals', 'won']]);
    // Stated the other way too, because this is the half that would rot
    // silently: no bare rule OBJECT may survive into the outgoing filter.
    for (const node of params.$filter as unknown[]) {
      expect(Array.isArray(node)).toBe(true);
    }
  });

  it('leaves an already-composed AST untouched', async () => {
    // The `ElementDataSourceGate` path (and any URL triple) arrives here as AST
    // already. `toFilterNode` must be a no-op for it — a second lowering pass
    // would be the mirror-image defect.
    const key = declaredFilterInput('object-grid')!.name;
    const params = await findParamsFor({
      type: 'object-grid',
      objectName: 'account',
      columns: [{ field: 'name' }],
      [key]: ['and', ['stage', '=', 'won'], ['amount', '>', 100]],
    });
    expect(params.$filter).toEqual(['and', ['stage', '=', 'won'], ['amount', '>', 100]]);
  });

  it('skips `$filter` entirely for a declared-but-empty filter', async () => {
    // Rather than sending `$filter: []`, which asks the server a question with
    // no content. `toFilterNode`'s documented contract, now honoured here too.
    const key = declaredFilterInput('object-grid')!.name;
    const params = await findParamsFor({
      type: 'object-grid',
      objectName: 'account',
      columns: [{ field: 'name' }],
      [key]: [],
    });
    expect(params.$filter).toBeUndefined();
  });
});

describe('object-grid — the retired plural spelling (historical record, objectui#4041)', () => {
  it('never reached the query, which is why deleting it breaks no working usage', async () => {
    // The state of the world BEFORE this change, pinned so the ruling's premise
    // stays checkable: `filters` was published, accepted by the save gate, and
    // dropped on the floor. Nobody could have a working grid that depends on
    // it, so option A removes a key with no users rather than a contract.
    const params = await findParamsFor({
      type: 'object-grid',
      objectName: 'account',
      columns: [{ field: 'name' }],
      filters: [['stage', '=', 'won']],
    });
    expect(params.$filter).toBeUndefined();
  });
});
