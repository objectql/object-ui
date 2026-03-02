/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
