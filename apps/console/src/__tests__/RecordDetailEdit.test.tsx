/**
 * RecordDetailView — recordId handling tests
 *
 * Validates that the URL-based recordId is passed through as-is to the
 * findOne API and onEdit callback. The navigation code puts the actual
 * record._id into the URL, so no prefix stripping is needed.
 *
 * Related: objectstack-ai/objectui — "Record not found" bug
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RecordDetailView } from '../components/RecordDetailView';
import type { DataSource } from '@object-ui/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

function createMockDataSource(): DataSource {
  return {
    async getObjectSchema() {
      return {
        name: 'contact',
        label: 'Contact',
        fields: {
          name: { name: 'name', label: 'Name', type: 'text' },
          email: { name: 'email', label: 'Email', type: 'email' },
        },
      };
    },
    findOne: vi.fn().mockResolvedValue({ id: 'contact-1772350253615-4', name: 'Alice' }),
    find: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(true),
  } as any;
}

const mockObjects = [
  {
    name: 'contact',
    label: 'Contact',
    fields: {
      name: { name: 'name', label: 'Name', type: 'text' },
      email: { name: 'email', label: 'Email', type: 'email' },
    },
  },
];

function renderDetailView(
  urlRecordId: string,
  objectName: string,
  onEdit: (record: any) => void,
  ds?: DataSource,
) {
  const dataSource = ds ?? createMockDataSource();
  return render(
    <MemoryRouter initialEntries={[`/${objectName}/record/${urlRecordId}`]}>
      <Routes>
        <Route
          path="/:objectName/record/:recordId"
          element={
            <RecordDetailView
              dataSource={dataSource}
              objects={mockObjects}
              onEdit={onEdit}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RecordDetailView — detail schema features', () => {
  it('renders auto tabs (Details tab) when autoTabs is enabled', async () => {
    const ds = createMockDataSource();
    renderDetailView('contact-1', 'contact', vi.fn(), ds);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alice');
    });

    // autoTabs: true should produce a "Details" tab trigger
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument();
  });

  it('auto-discovers related lists from objectSchema reference fields', async () => {
    const dsWithRefs: DataSource = {
      async getObjectSchema() {
        return {
          name: 'order',
          label: 'Order',
          fields: {
            name: { name: 'name', label: 'Name', type: 'text' },
            account: { name: 'account', label: 'Account', type: 'lookup', reference: 'account' },
          },
        };
      },
      findOne: vi.fn().mockResolvedValue({ id: 'order-1', name: 'Order #1' }),
      find: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: '1' }),
      update: vi.fn().mockResolvedValue({ id: '1' }),
      delete: vi.fn().mockResolvedValue(true),
    } as any;

    const objectsWithRefs = [
      {
        name: 'order',
        label: 'Order',
        fields: {
          name: { name: 'name', label: 'Name', type: 'text' },
          account: { name: 'account', label: 'Account', type: 'lookup', reference: 'account' },
        },
      },
    ];

    render(
      <MemoryRouter initialEntries={['/order/record/order-1']}>
        <Routes>
          <Route
            path="/:objectName/record/:recordId"
            element={
              <RecordDetailView
                dataSource={dsWithRefs}
                objects={objectsWithRefs}
                onEdit={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order #1');
    });

    // autoDiscoverRelated: true + lookup field should produce a "Related" tab
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Related/ })).toBeInTheDocument();
    });
  });

  it('renders highlight fields for key field types', async () => {
    const objectsWithStatus = [
      {
        name: 'contact',
        label: 'Contact',
        fields: {
          name: { name: 'name', label: 'Name', type: 'text' },
          email: { name: 'email', label: 'Email', type: 'email' },
          status: { name: 'status', label: 'Status', type: 'select' },
        },
      },
    ];

    const ds: DataSource = {
      ...createMockDataSource(),
      findOne: vi.fn().mockResolvedValue({ id: 'c-1', name: 'Alice', status: 'Active' }),
    } as any;

    render(
      <MemoryRouter initialEntries={['/contact/record/c-1']}>
        <Routes>
          <Route
            path="/:objectName/record/:recordId"
            element={
              <RecordDetailView
                dataSource={ds}
                objects={objectsWithStatus}
                onEdit={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alice');
    });

    // The highlightFields should render "Status" label in the highlight banner
    // (also appears in the detail section, so multiple matches expected)
    const statusElements = screen.getAllByText('Status');
    expect(statusElements.length).toBeGreaterThanOrEqual(2); // highlight banner + detail section
    // The value "Active" should appear in the highlight area and/or detail section
    const activeElements = screen.getAllByText('Active');
    expect(activeElements.length).toBeGreaterThanOrEqual(1);
  });
  it('discovers and renders reverse-reference child objects (e.g., order_item → order)', async () => {
    const orderItemData = [
      { id: 'item-1', name: 'Widget A', quantity: 2 },
      { id: 'item-2', name: 'Widget B', quantity: 5 },
    ];

    const ds: DataSource = {
      async getObjectSchema() {
        return {
          name: 'order',
          label: 'Order',
          fields: {
            name: { name: 'name', label: 'Name', type: 'text' },
          },
        };
      },
      findOne: vi.fn().mockResolvedValue({ id: 'order-1', name: 'Order #1' }),
      find: vi.fn().mockImplementation((objectName: string) => {
        if (objectName === 'order_item') {
          return Promise.resolve({ data: orderItemData });
        }
        return Promise.resolve({ data: [] });
      }),
      create: vi.fn().mockResolvedValue({ id: '1' }),
      update: vi.fn().mockResolvedValue({ id: '1' }),
      delete: vi.fn().mockResolvedValue(true),
    } as any;

    // Use ObjectStack-convention 'reference' (not 'reference_to') to match real metadata
    const objectsWithChild = [
      {
        name: 'order',
        label: 'Order',
        fields: {
          name: { name: 'name', label: 'Name', type: 'text' },
        },
      },
      {
        name: 'order_item',
        label: 'Order Item',
        fields: {
          name: { name: 'name', label: 'Line Item', type: 'text' },
          order: { name: 'order', label: 'Order', type: 'lookup', reference: 'order' },
          quantity: { name: 'quantity', label: 'Quantity', type: 'number' },
        },
      },
    ];

    render(
      <MemoryRouter initialEntries={['/order/record/order-1']}>
        <Routes>
          <Route
            path="/:objectName/record/:recordId"
            element={
              <RecordDetailView
                dataSource={ds}
                objects={objectsWithChild}
                onEdit={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order #1');
    });

    // Should fetch child records filtered by parent ID
    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledWith('order_item', {
        $filter: { order: 'order-1' },
      });
    });

    // Related tab should appear (child object discovered)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Related/ })).toBeInTheDocument();
    });

    // Click on the Related tab to reveal its content
    await userEvent.click(screen.getByRole('tab', { name: /Related/ }));

    // The child object title should appear in the related list card
    await waitFor(() => {
      expect(screen.getByText('Order Item')).toBeInTheDocument();
    });
  });
});

describe('RecordDetailView — recordId handling', () => {
  it('passes URL recordId as-is to findOne (with objectName prefix)', async () => {
    const onEdit = vi.fn();
    const ds = createMockDataSource();

    renderDetailView('contact-1772350253615-4', 'contact', onEdit, ds);

    // Wait for the detail view to load (primaryField "name" renders as heading)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alice');
    });

    // findOne should be called with the FULL URL recordId (no stripping)
    expect(ds.findOne).toHaveBeenCalledWith('contact', 'contact-1772350253615-4');

    // Click the Edit button
    const editButton = await screen.findByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    // The onEdit callback should receive the FULL recordId
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'contact-1772350253615-4',
        _id: 'contact-1772350253615-4',
      }),
    );
  });

  it('passes recordId as-is when no objectName prefix', async () => {
    const onEdit = vi.fn();
    const ds = createMockDataSource();

    renderDetailView('plain-id-12345', 'contact', onEdit, ds);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alice');
    });

    // findOne should be called with the original ID unchanged
    expect(ds.findOne).toHaveBeenCalledWith('contact', 'plain-id-12345');

    const editButton = await screen.findByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    // Should pass the original recordId unchanged
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'plain-id-12345',
        _id: 'plain-id-12345',
      }),
    );
  });
});
