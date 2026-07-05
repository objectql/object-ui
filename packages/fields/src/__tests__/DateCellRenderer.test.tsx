/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DateCellRenderer, formatRelativeDate } from '../index';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe('formatRelativeDate', () => {
  it('renders "Overdue Nd" only when dueLike is set', () => {
    expect(formatRelativeDate(daysAgo(3), { dueLike: true })).toBe('Overdue 3d');
  });

  it('renders neutral "Nd ago" for a past date that is not due-like', () => {
    expect(formatRelativeDate(daysAgo(3))).toBe('3d ago');
    expect(formatRelativeDate(daysAgo(3), { dueLike: false })).toBe('3d ago');
  });
});

describe('DateCellRenderer', () => {
  it('does not label a past start_date as "Overdue" (regression: field-role-agnostic formatter)', () => {
    render(<DateCellRenderer value={daysAgo(6)} field={{ type: 'date', name: 'start_date' } as any} />);
    expect(screen.getByText('6d ago')).toBeInTheDocument();
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });

  it('labels a past due_date as "Overdue Nd" and colors it red', () => {
    render(<DateCellRenderer value={daysAgo(6)} field={{ type: 'date', name: 'due_date' } as any} />);
    const el = screen.getByText('Overdue 6d');
    expect(el).toBeInTheDocument();
    expect(el.className).toMatch(/text-red-600/);
  });

  it('respects an explicit dueLike:true override regardless of field name', () => {
    render(<DateCellRenderer value={daysAgo(2)} field={{ type: 'date', name: 'end_date', dueLike: true } as any} />);
    expect(screen.getByText('Overdue 2d')).toBeInTheDocument();
  });
});
