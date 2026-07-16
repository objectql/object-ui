/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * DashboardFilterBar — `optionsFrom` dynamic options, server-side first
 * (#2578 item 5): with a dataset-capable data source, distinct option values
 * come from a server GROUP BY (inline dataset draft over the source object);
 * the original client-side top-200 dedupe is only the fallback.
 */

import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { DashboardFilterBar } from '../DashboardFilterBar';
import type { DashboardFilterDef } from '@object-ui/core';

afterEach(cleanup);

const defs: DashboardFilterDef[] = [
  {
    name: 'industry',
    field: 'industry',
    type: 'select',
    optionsFrom: { object: 'accounts', valueField: 'industry', labelField: 'industry' },
  } as DashboardFilterDef,
];

function renderBar(dataSource: any) {
  return render(
    <DashboardFilterBar defs={defs} values={{}} onChange={vi.fn()} dataSource={dataSource} />,
  );
}

describe('DashboardFilterBar — optionsFrom fetching', () => {
  it('uses a server-side dataset query (GROUP BY distinct) when available', async () => {
    const queryDataset = vi.fn().mockResolvedValue({
      rows: [
        { industry: 'finance', option_count: 3 },
        { industry: 'retail', option_count: 2 },
      ],
    });
    const find = vi.fn();
    renderBar({ queryDataset, find });

    await waitFor(() => expect(queryDataset).toHaveBeenCalledTimes(1));
    const [draft, selection] = queryDataset.mock.calls[0];
    expect(draft).toMatchObject({
      object: 'accounts',
      dimensions: [{ name: 'industry', field: 'industry' }],
      measures: [{ name: 'option_count', aggregate: 'count' }],
    });
    expect(selection).toMatchObject({
      dimensions: ['industry'],
      measures: ['option_count'],
      order: { industry: 'asc' },
    });
    // The server path won — no record scan needed.
    expect(find).not.toHaveBeenCalled();
    expect(screen.getByTestId('dashboard-filter-industry')).toBeInTheDocument();
  });

  it('falls back to the client-side top-200 dedupe when the dataset query fails', async () => {
    const queryDataset = vi.fn().mockRejectedValue(new Error('datasets unsupported'));
    const find = vi.fn().mockResolvedValue([
      { industry: 'finance' },
      { industry: 'finance' },
      { industry: 'retail' },
    ]);
    renderBar({ queryDataset, find });

    await waitFor(() => expect(find).toHaveBeenCalledTimes(1));
    expect(find).toHaveBeenCalledWith('accounts', expect.objectContaining({ top: 200 }));
  });

  it('uses the client-side path directly when the data source has no queryDataset', async () => {
    const find = vi.fn().mockResolvedValue([{ industry: 'retail' }]);
    renderBar({ find });
    await waitFor(() => expect(find).toHaveBeenCalledTimes(1));
  });
});
