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

  it('should return SelectCellRenderer for status type', () => {
    const renderer = getCellRenderer('status');
    expect(renderer).toBeDefined();
    // Verify it renders a badge (same as select)
    const { container } = render(
      React.createElement(renderer, {
        value: 'Active',
        field: { name: 'status', type: 'status', options: [{ value: 'Active', label: 'Active', color: 'green' }] } as any,
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
  beforeEach(() => {
    // Fix "now" to a known date: 2026-02-24T12:00:00Z using fake timers
    // so that new Date() in formatRelativeDate returns a predictable value
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('should render recent past date as "Overdue Xd"', () => {
    render(
      <DateCellRenderer
        value="2026-02-20T08:00:00Z"
        field={{ name: 'due_date', type: 'date' } as any}
      />
    );
    expect(screen.getByText('Overdue 4d')).toBeInTheDocument();
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

  it('should render green circle indicator for is_completed=true', () => {
    const { container } = render(
      <BooleanCellRenderer
        value={true}
        field={{ name: 'is_completed', type: 'boolean' } as any}
      />
    );
    const indicator = container.querySelector('[data-testid="completion-indicator"]');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('bg-green-500');
  });

  it('should render empty circle indicator for is_completed=false', () => {
    const { container } = render(
      <BooleanCellRenderer
        value={false}
        field={{ name: 'is_completed', type: 'boolean' } as any}
      />
    );
    const indicator = container.querySelector('[data-testid="completion-indicator"]');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('border-2');
  });

  it('should render green circle indicator for completed=true', () => {
    const { container } = render(
      <BooleanCellRenderer
        value={true}
        field={{ name: 'completed', type: 'boolean' } as any}
      />
    );
    const indicator = container.querySelector('[data-testid="completion-indicator"]');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('bg-green-500');
  });

  it('should render standard checkbox for non-completion boolean fields', () => {
    render(
      <BooleanCellRenderer
        value={true}
        field={{ name: 'active', type: 'boolean' } as any}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('data-state', 'checked');
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
    const today = new Date();
    expect(formatRelativeDate(today)).toBe('Today');
  });

  it('should return "Yesterday" for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeDate(yesterday)).toBe('Yesterday');
  });

  it('should return "Tomorrow" for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatRelativeDate(tomorrow)).toBe('Tomorrow');
  });

  it('should return "Overdue Xd" for 2-7 days ago', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(formatRelativeDate(threeDaysAgo)).toBe('Overdue 3d');
  });

  it('should return formatted date for >7 days ago', () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const result = formatRelativeDate(tenDaysAgo);
    const expected = tenDaysAgo.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    expect(result).toBe(expected);
  });

  it('should return "In X days" for 2-7 days in the future', () => {
    const fourDaysFromNow = new Date();
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);
    expect(formatRelativeDate(fourDaysFromNow)).toBe('In 4 days');
  });

  it('should return formatted date for >7 days in the future', () => {
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);
    const result = formatRelativeDate(fifteenDaysFromNow);
    const expected = fifteenDaysFromNow.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    expect(result).toBe(expected);
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
