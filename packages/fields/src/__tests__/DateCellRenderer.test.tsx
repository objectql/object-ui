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

  it('renders neutral "N days ago" for a past date that is not due-like', () => {
    expect(formatRelativeDate(daysAgo(3))).toBe('3 days ago');
    expect(formatRelativeDate(daysAgo(3), { dueLike: false })).toBe('3 days ago');
  });

  it('localizes the near-today window per locale (framework#3040)', () => {
    expect(formatRelativeDate(daysAgo(0), { locale: 'zh-CN' })).toBe('今天');
    expect(formatRelativeDate(daysAgo(-1), { locale: 'zh-CN' })).toBe('明天');
    expect(formatRelativeDate(daysAgo(1), { locale: 'zh-CN' })).toBe('昨天');
    expect(formatRelativeDate(daysAgo(-3), { locale: 'zh-CN' })).toBe('3天后');
    expect(formatRelativeDate(daysAgo(3), { locale: 'zh-CN' })).toBe('3天前');
    // English output is sentence-cased.
    expect(formatRelativeDate(daysAgo(-1))).toBe('Tomorrow');
    expect(formatRelativeDate(daysAgo(-3))).toBe('In 3 days');
  });

  it('resolves the overdue phrase through the i18n translate fn when provided', () => {
    const t = (key: string, params?: Record<string, unknown>) =>
      key === 'fields.relativeDate.overdue' ? `逾期 ${params?.count} 天` : key;
    expect(formatRelativeDate(daysAgo(3), { dueLike: true, t })).toBe('逾期 3 天');
    // A t() that misses (returns the key) keeps the English fallback.
    expect(formatRelativeDate(daysAgo(3), { dueLike: true, t: (k) => k })).toBe('Overdue 3d');
  });

  it('degrades to English when the locale tag is invalid', () => {
    expect(formatRelativeDate(daysAgo(3), { locale: 'not a locale' })).toBe('3 days ago');
  });
});

describe('DateCellRenderer', () => {
  it('does not label a past start_date as "Overdue" (regression: field-role-agnostic formatter)', () => {
    render(<DateCellRenderer value={daysAgo(6)} field={{ type: 'date', name: 'start_date' } as any} />);
    expect(screen.getByText('6 days ago')).toBeInTheDocument();
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
