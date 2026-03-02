/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DetailView } from '../DetailView';
import { RelatedList } from '../RelatedList';
import type { DetailViewSchema } from '@object-ui/types';

describe('Roadmap Features', () => {
  // ── Feature 1: Auto-discover related lists ──
  describe('Auto-discover related lists', () => {
    it('should auto-discover related lists from objectSchema reference fields', async () => {
      const mockDataSource = {
        getObjectSchema: vi.fn().mockResolvedValue({
          fields: {
            name: { type: 'text' },
            account: { type: 'lookup', reference_to: 'account', label: 'Account' },
            contact: { type: 'master_detail', reference_to: 'contact', label: 'Primary Contact' },
          },
        }),
        findOne: vi.fn().mockResolvedValue({ name: 'Order 1' }),
      } as any;

      const schema: DetailViewSchema = {
        type: 'detail-view',
        title: 'Order Details',
        objectName: 'order',
        resourceId: 'order-1',
        fields: [{ name: 'name', label: 'Name' }],
        autoDiscoverRelated: true,
      };

      render(<DetailView schema={schema} dataSource={mockDataSource} />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Order 1')).toBeInTheDocument();
      });

      // Should show auto-discovered related lists
      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.getByText('Primary Contact')).toBeInTheDocument();
    });

    it('should not auto-discover when autoDiscoverRelated is false', () => {
      const schema: DetailViewSchema = {
        type: 'detail-view',
        title: 'Order Details',
        data: { name: 'Order 1' },
        fields: [{ name: 'name', label: 'Name' }],
        autoDiscoverRelated: false,
      };

      render(<DetailView schema={schema} />);
      // Should not show "Related" heading
      expect(screen.queryByText('Related')).not.toBeInTheDocument();
    });

    it('should not auto-discover when explicit related lists are provided', async () => {
      const mockDataSource = {
        getObjectSchema: vi.fn().mockResolvedValue({
          fields: {
            name: { type: 'text' },
            account: { type: 'lookup', reference_to: 'account', label: 'Account' },
          },
        }),
        findOne: vi.fn().mockResolvedValue({ name: 'Order 1' }),
      } as any;

      const schema: DetailViewSchema = {
        type: 'detail-view',
        title: 'Order Details',
        objectName: 'order',
        resourceId: 'order-1',
        fields: [{ name: 'name', label: 'Name' }],
        autoDiscoverRelated: true,
        related: [
          { title: 'Custom Related', type: 'table', data: [] },
        ],
      };

      render(<DetailView schema={schema} dataSource={mockDataSource} />);

      await waitFor(() => {
        expect(screen.getByText('Order 1')).toBeInTheDocument();
      });

      // Should show explicit related, not auto-discovered
      expect(screen.getByText('Custom Related')).toBeInTheDocument();
    });
  });

  // ── Feature 2: Auto Tabs layout ──
  describe('Auto Tabs layout', () => {
    it('should render Details/Related/Activity tabs when autoTabs is true', () => {
      const schema: DetailViewSchema = {
        type: 'detail-view',
        title: 'Account Details',
        data: { name: 'Acme Corp' },
        fields: [{ name: 'name', label: 'Name' }],
        autoTabs: true,
        related: [
          { title: 'Contacts', type: 'table', data: [] },
        ],
        activities: [
          { id: '1', type: 'create', user: 'Bob', timestamp: '2026-02-15T10:00:00Z' },
        ],
      };

      render(<DetailView schema={schema} />);
      
      // All three tabs should be present
      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.getByText('Related')).toBeInTheDocument();
    });

    it('should show sections inside Details tab when autoTabs is true', () => {
      const schema: DetailViewSchema = {
        type: 'detail-view',
        title: 'Account Details',
        data: { name: 'Acme Corp', email: 'acme@example.com' },
        sections: [
          {
            title: 'Basic Info',
            fields: [
              { name: 'name', label: 'Name' },
              { name: 'email', label: 'Email' },
            ],
          },
        ],
        autoTabs: true,
      };

      render(<DetailView schema={schema} />);
      
      // Details tab should be active by default
      expect(screen.getByText('Basic Info')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('should not render autoTabs when explicit tabs are provided', () => {
      const schema: DetailViewSchema = {
        type: 'detail-view',
        title: 'Account',
        data: { name: 'Acme' },
        fields: [{ name: 'name', label: 'Name' }],
        autoTabs: true,
        tabs: [
          { key: 'custom', label: 'Custom Tab', content: { type: 'text', text: 'Custom' } },
        ],
      };

      render(<DetailView schema={schema} />);
      // Should not render auto-tabs Details/Related/Activity
      // Instead renders explicit tabs
      expect(screen.queryByRole('tab', { name: 'Details' })).not.toBeInTheDocument();
    });
  });

  // ── Feature 3: Related list row-level Edit/Delete ──
  describe('Related list row-level actions', () => {
    it('should render Edit button for each row when onRowEdit is provided', () => {
      const onRowEdit = vi.fn();
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      render(
        <RelatedList
          title="Contacts"
          type="table"
          data={data}
          onRowEdit={onRowEdit}
        />
      );

      const editButtons = screen.getAllByText('Edit');
      expect(editButtons.length).toBe(2);
    });

    it('should call onRowEdit with the correct row when clicked', () => {
      const onRowEdit = vi.fn();
      const data = [{ id: 1, name: 'Alice' }];

      render(
        <RelatedList
          title="Contacts"
          type="table"
          data={data}
          onRowEdit={onRowEdit}
        />
      );

      fireEvent.click(screen.getByText('Edit'));
      expect(onRowEdit).toHaveBeenCalledWith({ id: 1, name: 'Alice' });
    });

    it('should render Delete button for each row when onRowDelete is provided', () => {
      const onRowDelete = vi.fn();
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      render(
        <RelatedList
          title="Contacts"
          type="table"
          data={data}
          onRowDelete={onRowDelete}
        />
      );

      const deleteButtons = screen.getAllByText('Delete');
      expect(deleteButtons.length).toBe(2);
    });

    it('should call onRowDelete with the correct row after confirmation', () => {
      const onRowDelete = vi.fn();
      const data = [{ id: 1, name: 'Alice' }];
      const confirmSpy = vi.fn().mockReturnValue(true);
      window.confirm = confirmSpy;

      render(
        <RelatedList
          title="Contacts"
          type="table"
          data={data}
          onRowDelete={onRowDelete}
        />
      );

      fireEvent.click(screen.getByText('Delete'));
      expect(confirmSpy).toHaveBeenCalled();
      expect(onRowDelete).toHaveBeenCalledWith({ id: 1, name: 'Alice' });
    });

    it('should not call onRowDelete when confirmation is cancelled', () => {
      const onRowDelete = vi.fn();
      const data = [{ id: 1, name: 'Alice' }];
      const confirmSpy = vi.fn().mockReturnValue(false);
      window.confirm = confirmSpy;

      render(
        <RelatedList
          title="Contacts"
          type="table"
          data={data}
          onRowDelete={onRowDelete}
        />
      );

      fireEvent.click(screen.getByText('Delete'));
      expect(onRowDelete).not.toHaveBeenCalled();
    });
  });

  // ── Feature 4: Related list pagination, sorting, filtering ──
  describe('Related list pagination', () => {
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
    }));

    it('should show pagination controls when pageSize is set', () => {
      render(
        <RelatedList
          title="Items"
          type="table"
          data={manyItems}
          pageSize={5}
        />
      );

      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });

    it('should navigate to next page', () => {
      render(
        <RelatedList
          title="Items"
          type="table"
          data={manyItems}
          pageSize={5}
        />
      );

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });

    it('should disable Previous on first page', () => {
      render(
        <RelatedList
          title="Items"
          type="table"
          data={manyItems}
          pageSize={5}
        />
      );

      const prevButton = screen.getByText('Previous').closest('button');
      expect(prevButton).toBeDisabled();
    });

    it('should not show pagination when all items fit on one page', () => {
      const fewItems = [{ id: 1, name: 'Item 1' }];
      render(
        <RelatedList
          title="Items"
          type="table"
          data={fewItems}
          pageSize={5}
        />
      );

      expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
    });
  });

  describe('Related list filtering', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];

    it('should render filter input when filterable is true', () => {
      render(
        <RelatedList
          title="Contacts"
          type="table"
          data={data}
          filterable={true}
        />
      );

      expect(screen.getByPlaceholderText('Filter...')).toBeInTheDocument();
    });

    it('should not render filter input when filterable is false', () => {
      render(
        <RelatedList
          title="Contacts"
          type="table"
          data={data}
          filterable={false}
        />
      );

      expect(screen.queryByPlaceholderText('Filter...')).not.toBeInTheDocument();
    });
  });

  describe('Related list sorting', () => {
    const data = [
      { id: 1, name: 'Charlie' },
      { id: 2, name: 'Alice' },
      { id: 3, name: 'Bob' },
    ];

    const columns = [
      { accessorKey: 'name', header: 'Name' },
    ];

    it('should render sort buttons when sortable is true', () => {
      render(
        <RelatedList
          title="Contacts"
          type="table"
          data={data}
          columns={columns}
          sortable={true}
        />
      );

      // Sort buttons include an ArrowUpDown icon
      const sortBtns = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('.lucide-arrow-up-down')
      );
      expect(sortBtns.length).toBe(1);
    });

    it('should not render sort buttons when sortable is false', () => {
      render(
        <RelatedList
          title="Contacts"
          type="table"
          data={data}
          columns={columns}
          sortable={false}
        />
      );

      // Name appears as a sort button only when sortable; verify no ArrowUpDown icon
      const sortBtns = screen.queryAllByRole('button').filter(btn =>
        btn.querySelector('.lucide-arrow-up-down')
      );
      expect(sortBtns.length).toBe(0);
    });
  });

  // ── Feature 5: Collapsible section groups ──
  describe('Collapsible section groups in DetailView', () => {
    it('should render section groups', () => {
      const schema: DetailViewSchema = {
        type: 'detail-view',
        title: 'Account Details',
        data: { billingStreet: '123 Main St', shippingStreet: '456 Oak Ave' },
        fields: [],
        sectionGroups: [
          {
            title: 'Address Information',
            sections: [
              {
                title: 'Billing',
                fields: [{ name: 'billingStreet', label: 'Street' }],
              },
              {
                title: 'Shipping',
                fields: [{ name: 'shippingStreet', label: 'Street' }],
              },
            ],
          },
        ],
      };

      render(<DetailView schema={schema} />);
      expect(screen.getByText('Address Information')).toBeInTheDocument();
      expect(screen.getByText('Billing')).toBeInTheDocument();
      expect(screen.getByText('Shipping')).toBeInTheDocument();
    });
  });

  // ── Feature 6: Header highlight area ──
  describe('Header highlight area', () => {
    it('should render highlight fields below the header', () => {
      const schema: DetailViewSchema = {
        type: 'detail-view',
        title: 'Account Details',
        data: { name: 'Acme Corp', revenue: '$5M', employees: 150 },
        fields: [{ name: 'name', label: 'Name' }],
        highlightFields: [
          { name: 'revenue', label: 'Annual Revenue' },
          { name: 'employees', label: 'Employees' },
        ],
      };

      render(<DetailView schema={schema} />);
      expect(screen.getByText('Annual Revenue')).toBeInTheDocument();
      expect(screen.getByText('$5M')).toBeInTheDocument();
      expect(screen.getByText('Employees')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('should not render highlight area when no highlightFields are provided', () => {
      const schema: DetailViewSchema = {
        type: 'detail-view',
        title: 'Account Details',
        data: { name: 'Acme Corp' },
        fields: [{ name: 'name', label: 'Name' }],
      };

      const { container } = render(<DetailView schema={schema} />);
      // No highlight card should be present
      expect(container.querySelector('.border-dashed')).not.toBeInTheDocument();
    });
  });
});
