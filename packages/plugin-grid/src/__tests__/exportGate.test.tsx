/**
 * Export permission gate — object-level `operations.export`.
 *
 * Covers the hard gate: when `operations.export === false` the export button
 * is hidden; default-allow keeps it visible when the key is omitted.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

/**
 * Dead-format gate (objectui#2942): declared formats the runtime cannot
 * deliver must not render as menu items whose click silently does nothing.
 * pdf is implemented nowhere; xlsx needs the server stream, which inline
 * (provider: 'value') data never has.
 */
describe('ObjectGrid export dead formats', () => {
  it('drops pdf and (with inline data) xlsx from the menu, keeping csv', async () => {
    renderGrid({ exportOptions: { formats: ['csv', 'xlsx', 'pdf'] } });

    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    expect(await screen.findByRole('button', { name: /export as csv/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export as pdf/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /export as xlsx/i })).toBeNull();
  });

  it('hides the export button entirely when no declared format is deliverable', () => {
    renderGrid({ exportOptions: { formats: ['pdf'] } });
    expect(screen.queryAllByRole('button', { name: /export/i }).length).toBe(0);
  });
});
