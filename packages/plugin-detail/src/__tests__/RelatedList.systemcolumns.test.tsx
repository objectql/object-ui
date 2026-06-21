/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Regression coverage: auto-derived related-list columns must NOT lead with
 * system audit fields (created_at / updated_at / …). For a child object with no
 * name/title field (e.g. invoice lines), those system fields previously filled
 * the leading columns and pushed business columns (qty, price, amount) past the
 * column cap. System audit fields are now sorted last.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { RelatedList } from '../RelatedList';

// Declare the system audit fields FIRST to reproduce the pre-fix ordering.
const fields = {
  created_at: { type: 'datetime', label: 'Created At' },
  updated_at: { type: 'datetime', label: 'Last Modified At' },
  created_by: { type: 'text', label: 'Created By' },
  updated_by: { type: 'text', label: 'Updated By' },
  product: { type: 'text', label: 'Product' },
  description: { type: 'text', label: 'Description' },
  quantity: { type: 'number', label: 'Qty' },
};

const makeDS = (rows: any[]) => ({
  find: vi.fn(async () => rows),
  getObjectSchema: vi.fn(async () => ({ name: 'line', fields })),
});

describe('RelatedList — system audit columns are deprioritized', () => {
  it('orders business columns before created_at / updated_at', async () => {
    const rows = [{
      id: 'l1', product: 'Widget', description: 'd', quantity: 2,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
      created_by: 'u', updated_by: 'u',
    }];
    render(
      <RelatedList
        title="Lines"
        type="table"
        api="line"
        objectName="line"
        referenceField="invoice"
        parentId="INV-1"
        sortable
        dataSource={makeDS(rows) as any}
      />,
    );

    // `sortable` renders one button per effective column, in column order.
    const labels = await waitFor(() => {
      const texts = screen.getAllByRole('button').map((b) => (b.textContent || '').trim());
      if (!texts.some((t) => t.includes('Product'))) throw new Error('headers not ready');
      return texts;
    });
    const idx = (s: string) => labels.findIndex((t) => t.includes(s));

    expect(idx('Product')).toBeGreaterThanOrEqual(0);
    // A business field must lead; any shown system audit column comes after it.
    if (idx('Created At') >= 0) expect(idx('Product')).toBeLessThan(idx('Created At'));
    if (idx('Last Modified At') >= 0) expect(idx('Product')).toBeLessThan(idx('Last Modified At'));
  });
});
