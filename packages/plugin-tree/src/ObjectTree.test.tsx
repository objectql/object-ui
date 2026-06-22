import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { ObjectTree } from './ObjectTree';

afterEach(cleanup);

// A small self-referencing org hierarchy:
//   Acme
//   ├─ Engineering
//   │  └─ Platform
//   └─ Sales
const orgUnits = [
  { id: '1', name: 'Acme', parent_id: null, head: 'CEO' },
  { id: '2', name: 'Engineering', parent_id: '1', head: 'VP Eng' },
  { id: '3', name: 'Platform', parent_id: '2', head: 'Director' },
  { id: '4', name: 'Sales', parent_id: '1', head: 'VP Sales' },
];

function renderTree(extra: any = {}) {
  const schema: any = {
    type: 'object-tree',
    objectName: 'business_unit',
    parentField: 'parent_id',
    labelField: 'name',
    fields: ['name', 'head'],
    data: orgUnits,
    ...extra,
  };
  return render(<ObjectTree schema={schema} data={orgUnits} />);
}

describe('ObjectTree', () => {
  it('renders a nested forest from flat records (all expanded by default)', async () => {
    renderTree();
    await waitFor(() => expect(screen.getByTestId('object-tree')).toBeTruthy());
    // Every record is visible when fully expanded.
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.getByText('Engineering')).toBeTruthy();
    expect(screen.getByText('Platform')).toBeTruthy();
    expect(screen.getByText('Sales')).toBeTruthy();
  });

  it('indents children by depth', async () => {
    renderTree();
    await waitFor(() => expect(screen.getByTestId('object-tree')).toBeTruthy());
    const rows = screen.getAllByTestId('object-tree-row');
    const byName = (n: string) =>
      rows.find((r) => r.textContent?.includes(n))!;
    expect(byName('Acme').getAttribute('data-depth')).toBe('0');
    expect(byName('Engineering').getAttribute('data-depth')).toBe('1');
    expect(byName('Platform').getAttribute('data-depth')).toBe('2');
  });

  it('collapses and expands a subtree on chevron click', async () => {
    renderTree();
    await waitFor(() => expect(screen.getByTestId('object-tree')).toBeTruthy());

    // Collapse "Engineering" → Platform disappears, siblings stay.
    const engRow = screen
      .getAllByTestId('object-tree-row')
      .find((r) => r.textContent?.includes('Engineering'))!;
    const toggle = engRow.querySelector('button')!;
    fireEvent.click(toggle);

    await waitFor(() => expect(screen.queryByText('Platform')).toBeNull());
    expect(screen.getByText('Sales')).toBeTruthy();

    // Expand again → Platform returns.
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByText('Platform')).toBeTruthy());
  });

  it('respects defaultExpandedDepth=0 (roots only)', async () => {
    renderTree({ defaultExpandedDepth: 0 });
    await waitFor(() => expect(screen.getByTestId('object-tree')).toBeTruthy());
    expect(screen.getByText('Acme')).toBeTruthy();
    // Children of the root are hidden until expanded.
    expect(screen.queryByText('Engineering')).toBeNull();
  });

  it('keeps orphan records (parent outside the result set) as roots', async () => {
    const orphans = [
      { id: '10', name: 'Floating', parent_id: '999' },
    ];
    render(
      <ObjectTree
        schema={{ type: 'object-tree', objectName: 'x', parentField: 'parent_id', labelField: 'name', data: orphans }}
        data={orphans}
      />,
    );
    await waitFor(() => expect(screen.getByText('Floating')).toBeTruthy());
  });
});
