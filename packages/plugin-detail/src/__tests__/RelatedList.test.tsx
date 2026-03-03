/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RelatedList } from '../RelatedList';

describe('RelatedList', () => {
  it('should render title', () => {
    render(<RelatedList title="Contacts" type="table" data={[]} />);
    expect(screen.getByText('Contacts')).toBeInTheDocument();
  });

  it('should show record count for empty list', () => {
    render(<RelatedList title="Contacts" type="table" data={[]} />);
    expect(screen.getByText('0 records')).toBeInTheDocument();
  });

  it('should show singular record count for one item', () => {
    render(<RelatedList title="Contacts" type="table" data={[{ id: 1, name: 'Alice' }]} />);
    expect(screen.getByText('1 record')).toBeInTheDocument();
  });

  it('should show plural record count for multiple items', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    render(<RelatedList title="Orders" type="table" data={data} />);
    expect(screen.getByText('2 records')).toBeInTheDocument();
  });

  it('should show "No related records found" for empty data', () => {
    render(<RelatedList title="Contacts" type="table" data={[]} />);
    expect(screen.getByText('No related records found')).toBeInTheDocument();
  });

  it('should render New button when onNew callback is provided', () => {
    const onNew = vi.fn();
    render(<RelatedList title="Contacts" type="table" data={[]} onNew={onNew} />);
    const newButton = screen.getByText('New');
    expect(newButton).toBeInTheDocument();
    fireEvent.click(newButton);
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('should render View All button when onViewAll callback is provided', () => {
    const onViewAll = vi.fn();
    render(<RelatedList title="Contacts" type="table" data={[]} onViewAll={onViewAll} />);
    const viewAllButton = screen.getByText('View All');
    expect(viewAllButton).toBeInTheDocument();
    fireEvent.click(viewAllButton);
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it('should not render New or View All buttons when callbacks are not provided', () => {
    render(<RelatedList title="Contacts" type="table" data={[]} />);
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText('View All')).not.toBeInTheDocument();
  });

  it('should auto-generate columns from object schema when api and dataSource provided but no columns', async () => {
    const mockDataSource = {
      getObjectSchema: vi.fn().mockResolvedValue({
        name: 'order_item',
        fields: {
          product: { type: 'string', label: 'Product' },
          quantity: { type: 'number', label: 'Quantity' },
          _id: { type: 'string', label: 'ID' },
        },
      }),
      find: vi.fn(),
    } as any;

    const data = [{ product: 'Widget', quantity: 5 }];
    render(
      <RelatedList
        title="Order Items"
        type="table"
        api="order_item"
        data={data}
        dataSource={mockDataSource}
      />,
    );

    await waitFor(() => {
      expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('order_item');
    });

    // Verify columns are generated from schema (excluding _id)
    await waitFor(() => {
      expect(screen.getByText('Product')).toBeInTheDocument();
      expect(screen.getByText('Quantity')).toBeInTheDocument();
    });
    // _id should be filtered out
    expect(screen.queryByText('ID')).not.toBeInTheDocument();
  });

  it('should not fetch object schema when explicit columns are provided', () => {
    const mockDataSource = {
      getObjectSchema: vi.fn(),
      find: vi.fn(),
    } as any;

    const columns = [{ accessorKey: 'name', header: 'Name' }];
    render(
      <RelatedList
        title="Contacts"
        type="table"
        api="contact"
        data={[{ name: 'Alice' }]}
        columns={columns}
        dataSource={mockDataSource}
      />,
    );

    expect(mockDataSource.getObjectSchema).not.toHaveBeenCalled();
  });
});
