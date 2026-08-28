/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6592 — see `ObjectMap.discardedConfigMemo.test.tsx` for the full
 * rationale (`useMemo` carries no semantic guarantee, so a fetch effect
 * keyed on `dataConfig`'s object identity is correct only for as long as
 * that identity happens to survive). This file pins the same contract for
 * `ObjectTree`'s two fetch effects (object-schema fetch, record fetch).
 *
 * The discard proxy: two schema object literals with identical primitive
 * content but different references. `dataConfig = useMemo(() =>
 * getDataConfig(schema), [schema])` recomputes on the reference change and
 * `getDataConfig` builds a fresh wrapper object — the same "different
 * identity, same content" shape a genuine memo-cache discard would produce
 * with `schema` held constant.
 */

import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ObjectTree } from './ObjectTree';

afterEach(cleanup);

function makeDataSource(rows: any[]) {
  return {
    find: vi.fn().mockResolvedValue(rows),
    getObjectSchema: vi.fn().mockResolvedValue({ name: 'business_unit', fields: {} }),
  } as any;
}

const ROWS = [{ id: '1', name: 'Acme', parent_id: null }];

describe('ObjectTree — fetch effects survive a discarded `dataConfig` memo (objectui#6592)', () => {
  it('does not re-fire either fetch effect when `schema` gets a new reference with the SAME primitive fields', async () => {
    const dataSource = makeDataSource(ROWS);
    const schemaA: any = { type: 'object-tree', objectName: 'business_unit', parentField: 'parent_id', labelField: 'name' };
    const schemaB: any = { type: 'object-tree', objectName: 'business_unit', parentField: 'parent_id', labelField: 'name' };
    expect(schemaA).not.toBe(schemaB);
    expect(schemaA).toEqual(schemaB);

    const { rerender } = render(<ObjectTree schema={schemaA} dataSource={dataSource} />);
    await waitFor(() => expect(screen.getByTestId('object-tree')).toBeTruthy());
    await waitFor(() => expect(dataSource.find).toHaveBeenCalled());

    const findCallsAtRest = dataSource.find.mock.calls.length;
    const schemaCallsAtRest = dataSource.getObjectSchema.mock.calls.length;

    rerender(<ObjectTree schema={schemaB} dataSource={dataSource} />);
    await new Promise((r) => setTimeout(r, 0));

    expect(dataSource.find.mock.calls.length).toBe(findCallsAtRest);
    expect(dataSource.getObjectSchema.mock.calls.length).toBe(schemaCallsAtRest);
  });

  it('still DOES re-fire when the recomputed `dataConfig` carries a genuinely different `object`', async () => {
    const dataSource = makeDataSource(ROWS);
    const schemaA: any = { type: 'object-tree', objectName: 'business_unit', parentField: 'parent_id', labelField: 'name' };
    const schemaB: any = { type: 'object-tree', objectName: 'department', parentField: 'parent_id', labelField: 'name' };

    const { rerender } = render(<ObjectTree schema={schemaA} dataSource={dataSource} />);
    await waitFor(() => expect(dataSource.find).toHaveBeenCalledWith('business_unit', expect.any(Object)));
    const callsBefore = dataSource.find.mock.calls.length;

    rerender(<ObjectTree schema={schemaB} dataSource={dataSource} />);

    await waitFor(() => expect(dataSource.find.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(dataSource.find).toHaveBeenCalledWith('department', expect.any(Object));
  });
});
