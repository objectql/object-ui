/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:line_items` must DECLINE TO FETCH the child schema of a panel whose
 * child object it never resolved — not call `getObjectSchema(undefined)`
 * (objectui#6188).
 *
 * Same defect, same key name and same package as objectui#5940, which fixed the
 * sibling site in `MasterDetailForm`. `childObject` is declared
 * `required: true` on the registry entry for `record:line_items`
 * (`index.tsx`) and is typed `string` on `LineItemsPanelSchema`, but NOTHING
 * enforces either: `inputs[].required` is designer metadata (WidgetRegistry
 * copies it onto the ComponentRegistry entry and no one parses a node against
 * it), and the block has no spec schema at all — `@objectstack/spec` names
 * `record:line_items` only as an example of a type authored in the wild outside
 * its union. So a node reaches this renderer straight off an authored schema
 * with the key `undefined`, and the effect asked the data layer for it anyway.
 *
 * ## Why the assertions read a CALL LIST
 *
 * The symptom here is quieter than #5940's: the effect's `.catch` turns
 * whatever a real backend returns for an object literally named `undefined`
 * into a NULL child schema, and a null child schema is exactly what the panel
 * holds before any fetch resolves. So "it did not crash" and "the schema is
 * null" were both TRUE while the defect was live — no assertion on resulting
 * state could have caught it. Only the calls themselves distinguish the two
 * worlds.
 *
 * ## Why the second test is not redundant
 *
 * A "fix" that declined to fetch EVERYTHING would also make the bad call
 * disappear and would pass an absence-only assertion. Both directions are
 * therefore pinned: the unresolved panel does NOT fetch its child schema, and a
 * well-formed one still DOES.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `record:line_items`.
import './index';

const COLUMNS = [{ name: 'qty', label: 'Qty', type: 'number' as const }];

/**
 * The recording data source, the same shape objectui#5940's test used: a Proxy,
 * so ANY method the block reaches for is recorded rather than crashing it.
 *
 * Each call is recorded as `method(firstArgument)` — the OBJECT NAME argument,
 * which is the whole subject here, and `undefined` is spelled out rather than
 * collapsing to an empty argument. Deliberately NOT the full argument list: the
 * child fetch also carries `$filter` / `$top`, and pinning those would make this
 * file fail for changes that have nothing to do with the object name.
 */
function recordingDataSource(calls: string[]) {
  const record =
    (key: string) =>
    (...args: unknown[]) => {
      calls.push(`${key}(${args.length === 0 ? '' : (JSON.stringify(args[0]) ?? 'undefined')})`);
      return /^on[A-Z]/.test(key) || key === 'subscribe' ? () => {} : Promise.resolve({ data: [] });
    };
  const seeded: Record<string, unknown> = {};
  for (const m of ['find', 'findOne', 'create', 'update', 'delete', 'aggregate', 'getObjectSchema']) {
    seeded[m] = record(m);
  }
  return new Proxy(seeded, {
    get: (t, k: string) => (k in t ? (t as any)[k] : record(k)),
  }) as any;
}

async function callsFor(schemaExtra: Record<string, unknown>): Promise<string[]> {
  const calls: string[] = [];
  const schema: any = {
    type: 'record:line_items',
    relationshipField: 'invoice',
    // Authored directly, as `LineItemsPanel.elementDataSource.test.tsx` does:
    // this panel is bound to an EXISTING parent record, so a fixture without one
    // would settle the question for a panel no author ships.
    parentId: 'inv-1',
    columns: COLUMNS,
    ...schemaExtra,
  };
  const view = render(
    <SchemaRendererProvider dataSource={recordingDataSource(calls)}>
      <SchemaRenderer schema={schema} />
    </SchemaRendererProvider>,
  );
  // Settle: both reads run in effects, and the row load runs a second pass once
  // the first response lands.
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  try {
    view.unmount();
  } catch {
    /* teardown is not the subject */
  }
  return calls;
}

describe('record:line_items — a panel with no childObject (objectui#6188)', () => {
  it('declines to fetch the child schema instead of calling getObjectSchema(undefined)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const calls = await callsFor({});

    // The FULL LIST, not `.not.toContain(...)`: an absence-only assertion would
    // also pass for a panel that stopped fetching altogether, and the list is
    // what makes the remaining entry visible instead of implied.
    //
    // ⚠️ `find(undefined)` IS STILL HERE AND IS STILL WRONG. It is the SIBLING
    // site in this same component — `load()` guards `dataSource` and `parentId`
    // but not `schema.childObject`, so the row fetch still queries an object
    // literally named `undefined`. It is deliberately NOT fixed by objectui#6188,
    // whose dispatch order scoped this card to the `getObjectSchema` call and
    // said to FILE any further unguarded sub-key site rather than fix it; filed
    // as objectui#6194. Pinned here rather than hidden behind a narrower fixture
    // so the hole is recorded where the next reader will see it. When #6194
    // lands, this expectation becomes `toEqual([])` and the line below it goes.
    expect(calls).toEqual(['find(undefined)']);

    // Stated separately so a failure names which half broke.
    expect(calls).not.toContain('getObjectSchema(undefined)');

    // Declining silently would leave an author with a grid that is quietly
    // unsanitized and no reason why; `RelatedList` warns for the same class of
    // missing key ("has no referenceField/parentId — refusing to fetch all
    // rows"), and the warning names the key and what to set it to rather than
    // reporting that something was undefined.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('childObject'));
    warn.mockRestore();
  });

  it('still fetches the child schema of a panel that names its child object', async () => {
    // ⭐ The other direction. Without this, a panel that declined to fetch
    // EVERYTHING would pass the test above.
    const calls = await callsFor({ childObject: 'invoice_line' });

    expect(calls).toEqual(['getObjectSchema("invoice_line")', 'find("invoice_line")']);
    expect(calls).not.toContain('getObjectSchema(undefined)');
  });
});
