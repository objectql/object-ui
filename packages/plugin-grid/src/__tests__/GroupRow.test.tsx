/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GroupRow } from '../GroupRow';

describe('GroupRow', () => {
  it('renders group label and count', () => {
    render(
      <GroupRow
        groupKey="electronics"
        label="Electronics"
        count={5}
        collapsed={false}
        onToggle={() => {}}
      >
        <div>Content</div>
      </GroupRow>,
    );

    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('(5)')).toBeInTheDocument();
  });

  it('renders children when not collapsed', () => {
    render(
      <GroupRow
        groupKey="tools"
        label="Tools"
        count={3}
        collapsed={false}
        onToggle={() => {}}
      >
        <div data-testid="group-content">Group Content</div>
      </GroupRow>,
    );

    expect(screen.getByTestId('group-content')).toBeInTheDocument();
  });

  it('hides children when collapsed', () => {
    render(
      <GroupRow
        groupKey="tools"
        label="Tools"
        count={3}
        collapsed={true}
        onToggle={() => {}}
      >
        <div data-testid="group-content">Group Content</div>
      </GroupRow>,
    );

    expect(screen.queryByTestId('group-content')).not.toBeInTheDocument();
  });

  it('shows ChevronDown when expanded', () => {
    render(
      <GroupRow
        groupKey="tools"
        label="Tools"
        count={3}
        collapsed={false}
        onToggle={() => {}}
      >
        <div>Content</div>
      </GroupRow>,
    );

    // Lucide renders SVGs with class 'lucide-chevron-down'
    const button = screen.getByRole('button');
    expect(button.querySelector('.lucide-chevron-down')).toBeInTheDocument();
    expect(button.querySelector('.lucide-chevron-right')).not.toBeInTheDocument();
  });

  it('shows ChevronRight when collapsed', () => {
    render(
      <GroupRow
        groupKey="tools"
        label="Tools"
        count={3}
        collapsed={true}
        onToggle={() => {}}
      >
        <div>Content</div>
      </GroupRow>,
    );

    const button = screen.getByRole('button');
    expect(button.querySelector('.lucide-chevron-right')).toBeInTheDocument();
    expect(button.querySelector('.lucide-chevron-down')).not.toBeInTheDocument();
  });

  it('calls onToggle with groupKey when header is clicked', () => {
    const onToggle = vi.fn();
    render(
      <GroupRow
        groupKey="electronics"
        label="Electronics"
        count={5}
        collapsed={false}
        onToggle={onToggle}
      >
        <div>Content</div>
      </GroupRow>,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('electronics');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('sets aria-expanded=true when expanded', () => {
    render(
      <GroupRow
        groupKey="tools"
        label="Tools"
        count={3}
        collapsed={false}
        onToggle={() => {}}
      >
        <div>Content</div>
      </GroupRow>,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('sets aria-expanded=false when collapsed', () => {
    render(
      <GroupRow
        groupKey="tools"
        label="Tools"
        count={3}
        collapsed={true}
        onToggle={() => {}}
      >
        <div>Content</div>
      </GroupRow>,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders aggregation summary when provided', () => {
    const aggregations = [
      { field: 'amount', type: 'sum' as const, value: 150 },
      { field: 'amount', type: 'avg' as const, value: 37.5 },
    ];
    render(
      <GroupRow
        groupKey="electronics"
        label="Electronics"
        count={4}
        collapsed={false}
        aggregations={aggregations}
        onToggle={() => {}}
      >
        <div>Content</div>
      </GroupRow>,
    );

    expect(screen.getByText(/sum: 150/)).toBeInTheDocument();
    expect(screen.getByText(/avg: 37.50/)).toBeInTheDocument();
  });

  it('does not render aggregation section when aggregations is empty', () => {
    render(
      <GroupRow
        groupKey="electronics"
        label="Electronics"
        count={4}
        collapsed={false}
        aggregations={[]}
        onToggle={() => {}}
      >
        <div>Content</div>
      </GroupRow>,
    );

    expect(screen.queryByText(/sum:/)).not.toBeInTheDocument();
  });

  it('renders data-testid with group key', () => {
    render(
      <GroupRow
        groupKey="electronics"
        label="Electronics"
        count={5}
        collapsed={false}
        onToggle={() => {}}
      >
        <div>Content</div>
      </GroupRow>,
    );

    expect(screen.getByTestId('group-row-electronics')).toBeInTheDocument();
  });
});
