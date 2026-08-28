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
 * `ObjectCalendar`'s record-fetch effect.
 *
 * The discard proxy: two schema object literals with identical primitive
 * content but different references. `dataConfig`'s own `useMemo` here is
 * already keyed on primitives (`schema.data` / `schema.staticData` /
 * `schema.objectName` — objectui#6018's fix), so it does NOT recompute on
 * this reference change by itself; what is under test is the record-fetch
 * effect's OWN dependency array, which is why the assertion is on
 * `dataSource.find` / `getObjectSchema` call counts, not on `dataConfig`
 * identity directly.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { ObjectCalendar } from './ObjectCalendar';

afterEach(cleanup);

const today = new Date();
const dayInThisMonth = (d: number) => new Date(today.getFullYear(), today.getMonth(), d, 9, 0, 0, 0);

const ROWS = [{ id: 'v1', name: 'Site visit', starts_at: dayInThisMonth(10).toISOString() }];

function makeDataSource() {
  return {
    find: vi.fn().mockResolvedValue({ data: ROWS }),
    getObjectSchema: vi.fn().mockResolvedValue({ name: 'visit', fields: {} }),
  } as any;
}

const CALENDAR = { startDateField: 'starts_at', titleField: 'name' };

describe('ObjectCalendar — record-fetch effect survives a discarded `dataConfig` memo (objectui#6592)', () => {
  it('does not re-fire the fetch when `schema` gets a new reference with the SAME primitive fields', async () => {
    const dataSource = makeDataSource();
    const schemaA: any = { type: 'object-calendar', objectName: 'visit', calendar: CALENDAR };
    const schemaB: any = { type: 'object-calendar', objectName: 'visit', calendar: CALENDAR };
    expect(schemaA).not.toBe(schemaB);
    expect(schemaA).toEqual(schemaB);

    const { rerender } = render(<ObjectCalendar schema={schemaA} dataSource={dataSource} />);
    await waitFor(() => expect(screen.getByText('Site visit')).toBeTruthy());
    await waitFor(() => expect(dataSource.getObjectSchema).toHaveBeenCalled());

    const findCallsAtRest = dataSource.find.mock.calls.length;
    const schemaCallsAtRest = dataSource.getObjectSchema.mock.calls.length;
    expect(findCallsAtRest).toBeGreaterThan(0);

    rerender(<ObjectCalendar schema={schemaB} dataSource={dataSource} />);
    await new Promise((r) => setTimeout(r, 0));

    expect(dataSource.find.mock.calls.length).toBe(findCallsAtRest);
    expect(dataSource.getObjectSchema.mock.calls.length).toBe(schemaCallsAtRest);
  });

  it('still DOES re-fire when the recomputed `dataConfig` carries a genuinely different `object`', async () => {
    const dataSource = makeDataSource();
    const schemaA: any = { type: 'object-calendar', objectName: 'visit', calendar: CALENDAR };
    const schemaB: any = { type: 'object-calendar', objectName: 'appointment', calendar: CALENDAR };

    const { rerender } = render(<ObjectCalendar schema={schemaA} dataSource={dataSource} />);
    await waitFor(() => expect(dataSource.find).toHaveBeenCalledWith('visit', expect.any(Object)));
    const callsBefore = dataSource.find.mock.calls.length;

    rerender(<ObjectCalendar schema={schemaB} dataSource={dataSource} />);

    await waitFor(() => expect(dataSource.find.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(dataSource.find).toHaveBeenCalledWith('appointment', expect.any(Object));
  });
});
