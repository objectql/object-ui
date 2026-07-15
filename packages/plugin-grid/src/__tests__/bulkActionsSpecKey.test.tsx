/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression (#1763): a direct `object-grid` schema using the spec-canonical
 * `bulkActions` key (no legacy `batchActions`) used to silently no-op — the
 * grid only read `batchActions`, so bulk actions just disappeared with no
 * error. This locks in the fallback: `bulkActions` alone must auto-enable
 * multi-select and render the bulk action button, and `batchActions` must
 * still win when both keys are set (legacy precedence).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';
import type { ObjectGridSchema } from '@object-ui/types';

registerAllFields();

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn() as any;
  }
});

const OBJECT = 'os_prod_plan';

function makeDataSource() {
  const rows = [
    { id: 'r1', name: 'Plan A', status: 'draft' },
    { id: 'r2', name: 'Plan B', status: 'draft' },
  ];
  return {
    find: vi.fn(async () => ({ data: rows.map((r) => ({ ...r })), total: rows.length, hasMore: false, pageSize: 50 })),
    getObjectSchema: async (name: string) => ({
      name,
      fields: {
        id: { type: 'text' },
        name: { type: 'text' },
        status: { type: 'text' },
      },
    }),
  } as any;
}

function renderGrid(schema: ObjectGridSchema, handlers: Record<string, any> = {}) {
  return render(
    <ActionProvider handlers={handlers}>
      <ObjectGrid schema={schema} dataSource={makeDataSource()} />
    </ActionProvider>,
  );
}

async function selectAllRows() {
  await waitFor(() => expect(screen.getByText('Plan A')).toBeInTheDocument());
  const headerCheckbox = document.querySelector('thead [role="checkbox"]') as HTMLElement;
  expect(headerCheckbox).toBeTruthy();
  fireEvent.click(headerCheckbox);
}

describe('ObjectGrid — spec-canonical bulkActions key (#1763)', () => {
  it('renders bulk actions from `bulkActions` alone (no batchActions)', async () => {
    renderGrid({
      type: 'object-grid',
      objectName: OBJECT,
      bulkActions: ['approve'],
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'status', label: 'Status' },
      ],
      pagination: { pageSize: 50 },
    });

    await selectAllRows();
    expect(await screen.findByTestId('bulk-action-approve')).toBeInTheDocument();
  });

  it('keeps legacy precedence: batchActions wins when both keys are set', async () => {
    renderGrid({
      type: 'object-grid',
      objectName: OBJECT,
      batchActions: ['approve'],
      bulkActions: ['reject'],
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'status', label: 'Status' },
      ],
      pagination: { pageSize: 50 },
    });

    await selectAllRows();
    expect(await screen.findByTestId('bulk-action-approve')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-action-reject')).not.toBeInTheDocument();
  });
});
