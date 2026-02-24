/**
 * Cell Renderer Tests
 *
 * Tests for getCellRenderer() select/date/boolean type renderers
 * and formatRelativeDate() edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import {
  getCellRenderer,
  SelectCellRenderer,
  DateCellRenderer,
  BooleanCellRenderer,
  formatDate,
  formatRelativeDate,
} from '../index';

// =========================================================================
// 1. getCellRenderer type resolution
// =========================================================================
describe('getCellRenderer', () => {
  it('should return SelectCellRenderer for select type', () => {
    const renderer = getCellRenderer('select');
    expect(renderer).toBeDefined();
    // Verify it renders a badge
    const { container } = render(
      React.createElement(renderer, {
        value: 'Active',
        field: { name: 'status', type: 'select', options: [{ value: 'Active', label: 'Active', color: 'green' }] } as any,
      })
    );
    expect(container.querySelector('[class*="bg-green"]')).toBeInTheDocument();
  });

  it('should return DateCellRenderer for date type', () => {
    const renderer = getCellRenderer('date');
    expect(renderer).toBeDefined();
  });

  it('should return BooleanCellRenderer for boolean type', () => {
    const renderer = getCellRenderer('boolean');
    expect(renderer).toBeDefined();
  });

  it('should fallback to TextCellRenderer for unknown types', () => {
    const renderer = getCellRenderer('unknown-type');
    expect(renderer).toBeDefined();
  });
});

// =========================================================================
// 2. SelectCellRenderer
// =========================================================================
describe('SelectCellRenderer', () => {
  it('should render badge with explicit color from options', () => {
    const { container } = render(
      <SelectCellRenderer
        value="In Progress"
        field={{
          name: 'status',
          type: 'select',
          options: [{ value: 'In Progress', label: 'In Progress', color: 'blue' }],
        } as any}
      />
    );
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-blue-100"]')).toBeInTheDocument();
  });

  it('should use muted style when no color configured', () => {
    const { container } = render(
      <SelectCellRenderer
        value="Unknown"
        field={{
          name: 'status',
          type: 'select',
          options: [{ value: 'Unknown', label: 'Unknown' }],
        } as any}
      />
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-muted"]')).toBeInTheDocument();
  });

  it('should auto-detect priority semantic colors (Critical → red)', () => {
    const { container } = render(
      <SelectCellRenderer
        value="Critical"
        field={{ name: 'priority', type: 'select', options: [] } as any}
      />
    );
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-red-100"]')).toBeInTheDocument();
  });

  it('should auto-detect priority semantic colors (High → orange)', () => {
    const { container } = render(
      <SelectCellRenderer
        value="High"
        field={{ name: 'priority', type: 'select', options: [] } as any}
      />
    );
    expect(container.querySelector('[class*="bg-orange-100"]')).toBeInTheDocument();
  });

  it('should auto-detect priority semantic colors (Medium → yellow)', () => {
    const { container } = render(
      <SelectCellRenderer
        value="Medium"
        field={{ name: 'priority', type: 'select', options: [] } as any}
      />
    );
    expect(container.querySelector('[class*="bg-yellow-100"]')).toBeInTheDocument();
  });

  it('should auto-detect priority semantic colors (Low → gray)', () => {
    const { container } = render(
      <SelectCellRenderer
        value="Low"
        field={{ name: 'priority', type: 'select', options: [] } as any}
      />
    );
    expect(container.querySelector('[class*="bg-gray-100"]')).toBeInTheDocument();
  });

  it('should render dash for null/empty value', () => {
    render(
      <SelectCellRenderer
        value={null}
        field={{ name: 'status', type: 'select' } as any}
      />
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should render multiple badges for array values', () => {
    render(
      <SelectCellRenderer
        value={['Draft', 'Active']}
        field={{
          name: 'tags',
          type: 'select',
          options: [
            { value: 'Draft', label: 'Draft', color: 'yellow' },
            { value: 'Active', label: 'Active', color: 'green' },
          ],
        } as any}
      />
    );
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should prefer explicit option color over auto-detected', () => {
    const { container } = render(
      <SelectCellRenderer
        value="High"
        field={{
          name: 'priority',
          type: 'select',
          options: [{ value: 'High', label: 'High', color: 'purple' }],
        } as any}
      />
    );
    // Explicit purple should override auto-detected orange
    expect(container.querySelector('[class*="bg-purple-100"]')).toBeInTheDocument();
  });
});

// =========================================================================
// 3. DateCellRenderer
// =========================================================================
describe('DateCellRenderer', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Fix "now" to a known date: 2026-02-24T12:00:00Z
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-02-24T12:00:00Z').getTime());
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('should render today date as "Today"', () => {
    render(
      <DateCellRenderer
        value="2026-02-24T08:00:00Z"
        field={{ name: 'due_date', type: 'date' } as any}
      />
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should render yesterday date as "Yesterday"', () => {
    render(
      <DateCellRenderer
        value="2026-02-23T08:00:00Z"
        field={{ name: 'due_date', type: 'date' } as any}
      />
    );
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('should render recent past date as "X days ago"', () => {
    render(
      <DateCellRenderer
        value="2026-02-20T08:00:00Z"
        field={{ name: 'due_date', type: 'date' } as any}
      />
    );
    expect(screen.getByText('4 days ago')).toBeInTheDocument();
  });

  it('should render overdue date with red text styling', () => {
    const { container } = render(
      <DateCellRenderer
        value="2026-02-20T08:00:00Z"
        field={{ name: 'due_date', type: 'date' } as any}
      />
    );
    expect(container.querySelector('.text-red-600')).toBeInTheDocument();
  });

  it('should show ISO string as tooltip', () => {
    const { container } = render(
      <DateCellRenderer
        value="2026-02-20T08:00:00Z"
        field={{ name: 'due_date', type: 'date' } as any}
      />
    );
    const span = container.querySelector('span[title]');
    expect(span).toBeInTheDocument();
    expect(span?.getAttribute('title')).toContain('2026-02-20');
  });

  it('should render dash for null value', () => {
    const { container } = render(
      <DateCellRenderer
        value={null}
        field={{ name: 'due_date', type: 'date' } as any}
      />
    );
    expect(container.textContent).toBe('-');
  });

  it('should use explicit format when provided', () => {
    render(
      <DateCellRenderer
        value="2026-01-15T08:00:00Z"
        field={{ name: 'created', type: 'date', format: 'short' } as any}
      />
    );
    // Short format: "Jan 15, '26"
    expect(screen.getByText("Jan 15, '26")).toBeInTheDocument();
  });

  it('should not show red styling for future dates', () => {
    const { container } = render(
      <DateCellRenderer
        value="2026-03-01T08:00:00Z"
        field={{ name: 'due_date', type: 'date' } as any}
      />
    );
    expect(container.querySelector('.text-red-600')).not.toBeInTheDocument();
  });
});

// =========================================================================
// 4. BooleanCellRenderer
// =========================================================================
describe('BooleanCellRenderer', () => {
  it('should render checked checkbox for true', () => {
    render(
      <BooleanCellRenderer
        value={true}
        field={{ name: 'active', type: 'boolean' } as any}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('should render unchecked checkbox for false', () => {
    render(
      <BooleanCellRenderer
        value={false}
        field={{ name: 'active', type: 'boolean' } as any}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');
  });

  it('should render dash for null', () => {
    render(
      <BooleanCellRenderer
        value={null}
        field={{ name: 'active', type: 'boolean' } as any}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should render dash for undefined', () => {
    render(
      <BooleanCellRenderer
        value={undefined}
        field={{ name: 'active', type: 'boolean' } as any}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

// =========================================================================
// 5. formatRelativeDate edge cases
// =========================================================================
describe('formatRelativeDate', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-02-24T12:00:00Z').getTime());
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('should return "-" for null', () => {
    expect(formatRelativeDate(null as any)).toBe('-');
  });

  it('should return "-" for empty string', () => {
    expect(formatRelativeDate('')).toBe('-');
  });

  it('should return "-" for invalid date', () => {
    expect(formatRelativeDate('not-a-date')).toBe('-');
  });

  it('should return "Today" for today', () => {
    expect(formatRelativeDate('2026-02-24T08:00:00Z')).toBe('Today');
  });

  it('should return "Yesterday" for yesterday', () => {
    expect(formatRelativeDate('2026-02-23T08:00:00Z')).toBe('Yesterday');
  });

  it('should return "Tomorrow" for tomorrow', () => {
    expect(formatRelativeDate('2026-02-25T08:00:00Z')).toBe('Tomorrow');
  });

  it('should return "X days ago" for 2-7 days ago', () => {
    expect(formatRelativeDate('2026-02-21T08:00:00Z')).toBe('3 days ago');
  });

  it('should return formatted date for >7 days ago', () => {
    const result = formatRelativeDate('2026-02-10T08:00:00Z');
    // Should be a formatted date like "Feb 10, 2026", not "14 days ago"
    expect(result).toContain('Feb');
    expect(result).toContain('2026');
  });

  it('should return "In X days" for 2-7 days in the future', () => {
    expect(formatRelativeDate('2026-02-28T08:00:00Z')).toBe('In 4 days');
  });

  it('should return formatted date for >7 days in the future', () => {
    const result = formatRelativeDate('2026-03-15T08:00:00Z');
    expect(result).toContain('Mar');
    expect(result).toContain('2026');
  });
});

// =========================================================================
// 6. formatDate with relative style
// =========================================================================
describe('formatDate', () => {
  it('should return "-" for null', () => {
    expect(formatDate(null as any)).toBe('-');
  });

  it('should return "-" for invalid date', () => {
    expect(formatDate('invalid')).toBe('-');
  });

  it('should format as relative when style is "relative"', () => {
    // Just ensure it delegates to formatRelativeDate
    const result = formatDate(new Date(), 'relative');
    expect(result).toBe('Today');
  });

  it('should format in short style', () => {
    const result = formatDate('2026-01-15T08:00:00Z', 'short');
    expect(result).toBe("Jan 15, '26");
  });

  it('should format in default style (MMM DD, YYYY)', () => {
    const result = formatDate('2026-01-15T08:00:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });
});
