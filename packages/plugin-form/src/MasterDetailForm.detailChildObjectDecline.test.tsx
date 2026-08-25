/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-master-detail-form` must DECLINE TO FETCH a detail collection whose
 * child object it never resolved — not call `getObjectSchema(undefined)`
 * (objectui#5940).
 *
 * `childObject` is REQUIRED on `MasterDetailDetailConfig`, but a detail entry
 * reaches the renderer straight off an authored schema, so a malformed one
 * arrives with the key `undefined`. The renderer asked the data layer for it
 * anyway: a real backend receives a query for an object literally named
 * `undefined` and whatever it returns becomes the console's problem.
 * `RelatedList` already takes the other choice for the same class of missing key
 * ("has no referenceField/parentId — refusing to fetch all rows"), which is what
 * makes this a defect in one component rather than an open question.
 *
 * ## Why these assertions read the FULL CALL LIST
 *
 * This call is INVISIBLE to the binding-reach probe
 * (`apps/console/src/__tests__/public-block-binding-reach.test.tsx`), which asks
 * whether *any* call carried the object name — the first, correct call already
 * satisfies it. That probe was GREEN for as long as this defect was live, so a
 * green probe is not evidence and neither is any assertion of the same shape.
 * The defect surfaced only because the full list was read, and only an
 * exact-list assertion can keep it from reopening exactly as it opened.
 *
 * ## Why the second test is not redundant
 *
 * ⭐ A "fix" that declined to fetch *everything* would also make the bad call
 * disappear and would pass an absence-only assertion. Both directions are
 * therefore pinned: the unresolvable detail is NOT fetched, and a well-formed
 * one still IS. Measured against this file's own fixture before the guard
 * landed: `['getObjectSchema("probe_object__c")', 'getObjectSchema(undefined)']`.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Registers `object-master-detail-form`.
import './index';

const PROBE_OBJECT = 'probe_object__c';

/**
 * The recording data source, deliberately the same shape as the binding-reach
 * probe's (`dataCallsFor`): a Proxy, so ANY method the block reaches for is
 * recorded rather than crashing it, and every call is stringified with its
 * arguments so `undefined` is visible in the list rather than collapsing to an
 * empty argument.
 */
function recordingDataSource(calls: string[]) {
  const record =
    (key: string) =>
    (...args: unknown[]) => {
      calls.push(`${key}(${args.map((a) => JSON.stringify(a) ?? 'undefined').join(', ')})`);
      return /^on[A-Z]/.test(key) || key === 'subscribe' ? () => {} : Promise.resolve([]);
    };
  const seeded: Record<string, unknown> = {};
  for (const m of ['find', 'findOne', 'create', 'update', 'delete', 'aggregate', 'getObjectSchema']) {
    seeded[m] = record(m);
  }
  return new Proxy(seeded, {
    get: (t, k: string) => (k in t ? (t as any)[k] : record(k)),
  }) as any;
}

async function callsFor(details: unknown): Promise<string[]> {
  const calls: string[] = [];
  const schema: any = {
    type: 'object-master-detail-form',
    objectName: PROBE_OBJECT,
    mode: 'create',
    formType: 'simple',
    details,
  };
  const view = render(
    <SchemaRendererProvider dataSource={recordingDataSource(calls)}>
      <SchemaRenderer schema={schema} />
    </SchemaRendererProvider>,
  );
  // Settle: the detail resolution runs in an effect, and a second pass follows
  // once the object schema lands.
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

describe('object-master-detail-form — a detail collection with no child object (objectui#5940)', () => {
  it('declines to fetch instead of calling getObjectSchema(undefined)', async () => {
    // The #3840 binding-reach fixture's generic array sample: each entry is a
    // bare string, so `childObject` is `undefined` on every one of them.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const calls = await callsFor(['name']);

    // The FULL LIST, not `.not.toContain(...)`: an absence-only assertion is the
    // same shape that read green while the defect was live, and it would also
    // pass for a renderer that stopped fetching altogether. Pinning the exact
    // list states both halves at once — the parent binding is STILL made, and
    // nothing else is.
    expect(calls).toEqual([`getObjectSchema("${PROBE_OBJECT}")`]);

    // Stated separately so a failure names which half broke.
    expect(calls).toContain(`getObjectSchema("${PROBE_OBJECT}")`);
    expect(calls).not.toContain('getObjectSchema(undefined)');

    // Declining silently would leave an author with an empty grid and no reason;
    // `RelatedList` warns for the same case, so both components fail the same way.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('childObject'));
    warn.mockRestore();
  });

  it('still fetches the schema of a detail collection that names its child object', async () => {
    // ⭐ The other direction. Without this, a renderer that declined to fetch
    // EVERY detail would pass the test above.
    const calls = await callsFor([{ childObject: 'invoice_line', title: 'Invoice lines' }]);

    expect(calls).toContain('getObjectSchema("invoice_line")');
    expect(calls).not.toContain('getObjectSchema(undefined)');
  });
});
