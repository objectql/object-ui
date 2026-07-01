/**
 * Export permission gate — object-level `operations.export`.
 *
 * Covers the hard gate: when `operations.export === false` the export button
 * is hidden; default-allow keeps it visible when the key is omitted.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

const data = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

function renderGrid(opts?: Record<string, any>) {
  const schema: any = {
    type: 'object-grid',
    objectName: 'test_object',
    columns: [{ field: 'name', label: 'Name' }],
    data: { provider: 'value', items: data },
    exportOptions: { formats: ['csv', 'xlsx'] },
    ...opts,
  };
  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} />
    </ActionProvider>
  );
}

describe('ObjectGrid export permission gate', () => {
  it('shows the export button by default (operations.export omitted)', () => {
    renderGrid();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('hides the export button when operations.export is false', () => {
    renderGrid({ operations: { export: false } });
    expect(screen.queryAllByRole('button', { name: /export/i }).length).toBe(0);
  });

  it('keeps the export button when operations is set but export is omitted (default-allow)', () => {
    renderGrid({ operations: { create: false } });
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });
});
