/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjectGallery } from '../ObjectGallery';

const mockHandleClick = vi.fn();
const mockNavigationOverlay = {
  isOverlay: false,
  handleClick: mockHandleClick,
  selectedRecord: null,
  isOpen: false,
  close: vi.fn(),
  setIsOpen: vi.fn(),
  mode: 'page' as const,
  width: undefined,
  view: undefined,
  open: vi.fn(),
};

vi.mock('@object-ui/react', () => ({
  useDataScope: () => undefined,
  useSchemaContext: () => ({ dataSource: undefined }),
  useNavigationOverlay: () => mockNavigationOverlay,
}));

vi.mock('@object-ui/components', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  Card: ({ children, onClick, ...props }: any) => (
    <div data-testid="gallery-card" onClick={onClick} {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  NavigationOverlay: ({ children, selectedRecord }: any) => (
    selectedRecord ? <div data-testid="navigation-overlay">{children(selectedRecord)}</div> : null
  ),
}));

vi.mock('@object-ui/core', () => ({
  ComponentRegistry: { register: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  ChevronRight: () => <span data-testid="chevron-right">▸</span>,
  ChevronDown: () => <span data-testid="chevron-down">▾</span>,
}));

const mockItems = [
  { id: '1', name: 'Alpha Widget', category: 'Electronics', image: 'https://example.com/1.jpg' },
  { id: '2', name: 'Beta Gadget', category: 'Electronics', image: 'https://example.com/2.jpg' },
  { id: '3', name: 'Gamma Tool', category: 'Tools', image: 'https://example.com/3.jpg' },
  { id: '4', name: 'Delta Supply', category: 'Office', image: 'https://example.com/4.jpg' },
  { id: '5', name: 'Epsilon Gear', category: 'Tools', image: 'https://example.com/5.jpg' },
];

describe('ObjectGallery Grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without grouping (flat list) when no grouping config', () => {
    const schema = { objectName: 'products' };
    render(<ObjectGallery schema={schema} data={mockItems} />);

    // All items visible
    expect(screen.getByText('Alpha Widget')).toBeInTheDocument();
    expect(screen.getByText('Beta Gadget')).toBeInTheDocument();
    expect(screen.getByText('Gamma Tool')).toBeInTheDocument();
    expect(screen.getByText('Delta Supply')).toBeInTheDocument();
    expect(screen.getByText('Epsilon Gear')).toBeInTheDocument();

    // No group headers
    expect(screen.queryByText('Electronics')).not.toBeInTheDocument();
    expect(screen.queryByText('Tools')).not.toBeInTheDocument();
  });

  it('renders grouped sections when grouping config is provided', () => {
    const schema = {
      objectName: 'products',
      grouping: {
        fields: [{ field: 'category', order: 'asc' as const, collapsed: false }],
      },
    };
    render(<ObjectGallery schema={schema} data={mockItems} />);

    // Group headers should be visible
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Office')).toBeInTheDocument();

    // All items should be visible (none collapsed)
    expect(screen.getByText('Alpha Widget')).toBeInTheDocument();
    expect(screen.getByText('Beta Gadget')).toBeInTheDocument();
    expect(screen.getByText('Gamma Tool')).toBeInTheDocument();
    expect(screen.getByText('Delta Supply')).toBeInTheDocument();
    expect(screen.getByText('Epsilon Gear')).toBeInTheDocument();
  });

  it('shows record count per group', () => {
    const schema = {
      objectName: 'products',
      grouping: {
        fields: [{ field: 'category', order: 'asc' as const, collapsed: false }],
      },
    };
    render(<ObjectGallery schema={schema} data={mockItems} />);

    // Electronics has 2 items, Tools has 2, Office has 1
    const buttons = screen.getAllByRole('button');
    const electronicsBtn = buttons.find(b => b.textContent?.includes('Electronics'));
    const toolsBtn = buttons.find(b => b.textContent?.includes('Tools'));
    const officeBtn = buttons.find(b => b.textContent?.includes('Office'));

    expect(electronicsBtn?.textContent).toContain('2');
    expect(toolsBtn?.textContent).toContain('2');
    expect(officeBtn?.textContent).toContain('1');
  });

  it('collapses a group when clicking the group header', () => {
    const schema = {
      objectName: 'products',
      grouping: {
        fields: [{ field: 'category', order: 'asc' as const, collapsed: false }],
      },
    };
    render(<ObjectGallery schema={schema} data={mockItems} />);

    // All items visible initially
    expect(screen.getByText('Alpha Widget')).toBeInTheDocument();
    expect(screen.getByText('Beta Gadget')).toBeInTheDocument();

    // Click Electronics group header to collapse
    const buttons = screen.getAllByRole('button');
    const electronicsBtn = buttons.find(b => b.textContent?.includes('Electronics'))!;
    fireEvent.click(electronicsBtn);

    // Electronics items should be hidden
    expect(screen.queryByText('Alpha Widget')).not.toBeInTheDocument();
    expect(screen.queryByText('Beta Gadget')).not.toBeInTheDocument();

    // Other items still visible
    expect(screen.getByText('Gamma Tool')).toBeInTheDocument();
    expect(screen.getByText('Delta Supply')).toBeInTheDocument();
  });

  it('expands a collapsed group when clicking again', () => {
    const schema = {
      objectName: 'products',
      grouping: {
        fields: [{ field: 'category', order: 'asc' as const, collapsed: false }],
      },
    };
    render(<ObjectGallery schema={schema} data={mockItems} />);

    const buttons = screen.getAllByRole('button');
    const electronicsBtn = buttons.find(b => b.textContent?.includes('Electronics'))!;

    // Collapse
    fireEvent.click(electronicsBtn);
    expect(screen.queryByText('Alpha Widget')).not.toBeInTheDocument();

    // Expand
    fireEvent.click(electronicsBtn);
    expect(screen.getByText('Alpha Widget')).toBeInTheDocument();
    expect(screen.getByText('Beta Gadget')).toBeInTheDocument();
  });

  it('respects initial collapsed state from grouping config', () => {
    const schema = {
      objectName: 'products',
      grouping: {
        fields: [{ field: 'category', order: 'asc' as const, collapsed: true }],
      },
    };
    render(<ObjectGallery schema={schema} data={mockItems} />);

    // Group headers should be visible
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Office')).toBeInTheDocument();

    // All items should be hidden (all groups collapsed by default)
    expect(screen.queryByText('Alpha Widget')).not.toBeInTheDocument();
    expect(screen.queryByText('Beta Gadget')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma Tool')).not.toBeInTheDocument();
    expect(screen.queryByText('Delta Supply')).not.toBeInTheDocument();
    expect(screen.queryByText('Epsilon Gear')).not.toBeInTheDocument();
  });

  it('shows (empty) label for items with empty grouping field', () => {
    const items = [
      { id: '1', name: 'Item A', category: 'Cat1' },
      { id: '2', name: 'Item B', category: '' },
      { id: '3', name: 'Item C' }, // no category field
    ];
    const schema = {
      objectName: 'products',
      grouping: {
        fields: [{ field: 'category', order: 'asc' as const, collapsed: false }],
      },
    };
    render(<ObjectGallery schema={schema} data={items} />);

    expect(screen.getByText('Cat1')).toBeInTheDocument();
    expect(screen.getByText('(empty)')).toBeInTheDocument();
  });

  it('sorts groups by descending order when configured', () => {
    const schema = {
      objectName: 'products',
      grouping: {
        fields: [{ field: 'category', order: 'desc' as const, collapsed: false }],
      },
    };
    render(<ObjectGallery schema={schema} data={mockItems} />);

    const buttons = screen.getAllByRole('button');
    const labels = buttons.map(b => {
      // Extract the group label text (the <span> inside button)
      const spans = b.querySelectorAll('span');
      return spans[1]?.textContent; // label span
    }).filter(Boolean);

    // With desc order: Tools > Office > Electronics
    expect(labels[0]).toBe('Tools');
    expect(labels[1]).toBe('Office');
    expect(labels[2]).toBe('Electronics');
  });
});
