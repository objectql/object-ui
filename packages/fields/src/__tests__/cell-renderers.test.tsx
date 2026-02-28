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
  LookupCellRenderer,
  UserCellRenderer,
  TextCellRenderer,
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

  it('should return LookupCellRenderer for lookup type', () => {
    const renderer = getCellRenderer('lookup');
    expect(renderer).toBe(LookupCellRenderer);
  });

  it('should return LookupCellRenderer for master_detail type', () => {
    const renderer = getCellRenderer('master_detail');
    expect(renderer).toBe(LookupCellRenderer);
  });

  it('should return SelectCellRenderer for status type', () => {
    const renderer = getCellRenderer('status');
    expect(renderer).toBe(SelectCellRenderer);
  });

  it('should return UserCellRenderer for user type', () => {
    const renderer = getCellRenderer('user');
    expect(renderer).toBe(UserCellRenderer);
  });

  it('should return UserCellRenderer for owner type', () => {
    const renderer = getCellRenderer('owner');
    expect(renderer).toBe(UserCellRenderer);
  });
});

// =========================================================================
// 2. TextCellRenderer
// =========================================================================
describe('TextCellRenderer', () => {
  it('should render text value', () => {
    render(<TextCellRenderer value="hello" field={{ name: 'title', type: 'text' } as any} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('should render dash for null', () => {
    render(<TextCellRenderer value={null} field={{ name: 'title', type: 'text' } as any} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should render dash for undefined', () => {
    render(<TextCellRenderer value={undefined} field={{ name: 'title', type: 'text' } as any} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should render dash for empty string', () => {
    render(<TextCellRenderer value="" field={{ name: 'title', type: 'text' } as any} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should render "0" for numeric zero (not dash)', () => {
    render(<TextCellRenderer value={0} field={{ name: 'count', type: 'text' } as any} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should render "false" for boolean false (not dash)', () => {
    render(<TextCellRenderer value={false} field={{ name: 'flag', type: 'text' } as any} />);
    expect(screen.getByText('false')).toBeInTheDocument();
  });
});

// =========================================================================
// 3. SelectCellRenderer
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

// =========================================================================
// 7. LookupCellRenderer
// =========================================================================
describe('LookupCellRenderer', () => {
  it('should render dash for null value', () => {
    render(
      <LookupCellRenderer
        value={null}
        field={{ name: 'customer', type: 'lookup' } as any}
      />
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should render dash for empty string', () => {
    render(
      <LookupCellRenderer
        value=""
        field={{ name: 'customer', type: 'lookup' } as any}
      />
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should resolve primitive ID to label via field options', () => {
    render(
      <LookupCellRenderer
        value={2}
        field={{
          name: 'customer',
          type: 'lookup',
          options: [
            { value: 1, label: 'Alice' },
            { value: 2, label: 'Bob' },
          ],
        } as any}
      />
    );
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should resolve string ID to label via field options', () => {
    render(
      <LookupCellRenderer
        value="contact_1"
        field={{
          name: 'customer',
          type: 'lookup',
          options: [{ value: 'contact_1', label: 'Alice Smith' }],
        } as any}
      />
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('should render raw primitive when no options available', () => {
    render(
      <LookupCellRenderer
        value={42}
        field={{ name: 'customer', type: 'lookup' } as any}
      />
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render object name when value is an object', () => {
    render(
      <LookupCellRenderer
        value={{ name: 'Acme Corp', _id: '123' }}
        field={{ name: 'account', type: 'lookup' } as any}
      />
    );
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('should render object label when name is missing', () => {
    render(
      <LookupCellRenderer
        value={{ label: 'Widget Co', _id: '456' }}
        field={{ name: 'account', type: 'lookup' } as any}
      />
    );
    expect(screen.getByText('Widget Co')).toBeInTheDocument();
  });

  it('should render object _id as fallback', () => {
    render(
      <LookupCellRenderer
        value={{ _id: '789' }}
        field={{ name: 'account', type: 'lookup' } as any}
      />
    );
    expect(screen.getByText('789')).toBeInTheDocument();
  });

  it('should render tags for array of objects', () => {
    render(
      <LookupCellRenderer
        value={[{ name: 'Alice' }, { name: 'Bob' }]}
        field={{ name: 'contacts', type: 'lookup' } as any}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should resolve array of primitive IDs via options', () => {
    render(
      <LookupCellRenderer
        value={[1, 3]}
        field={{
          name: 'contacts',
          type: 'lookup',
          options: [
            { value: 1, label: 'Alice' },
            { value: 2, label: 'Bob' },
            { value: 3, label: 'Charlie' },
          ],
        } as any}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });
});

// =========================================================================
// 8. UserCellRenderer
// =========================================================================
describe('UserCellRenderer', () => {
  it('should render dash for null value', () => {
    render(
      <UserCellRenderer
        value={null}
        field={{ name: 'owner', type: 'user' } as any}
      />
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should render text for primitive user ID (number)', () => {
    render(
      <UserCellRenderer
        value={5}
        field={{ name: 'owner', type: 'user' } as any}
      />
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render text for primitive user ID (string)', () => {
    render(
      <UserCellRenderer
        value="user_abc"
        field={{ name: 'owner', type: 'user' } as any}
      />
    );
    expect(screen.getByText('user_abc')).toBeInTheDocument();
  });

  it('should render avatar and name for object value', () => {
    render(
      <UserCellRenderer
        value={{ name: 'John Doe', username: 'jdoe' }}
        field={{ name: 'owner', type: 'user' } as any}
      />
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should use username when name is missing', () => {
    render(
      <UserCellRenderer
        value={{ username: 'jdoe' }}
        field={{ name: 'owner', type: 'user' } as any}
      />
    );
    expect(screen.getByText('jdoe')).toBeInTheDocument();
  });

  it('should render multiple avatars for array of user objects', () => {
    render(
      <UserCellRenderer
        value={[{ name: 'Alice' }, { name: 'Bob' }]}
        field={{ name: 'assignees', type: 'user' } as any}
      />
    );
    // Avatar fallbacks contain initials
    expect(screen.getByTitle('Alice')).toBeInTheDocument();
    expect(screen.getByTitle('Bob')).toBeInTheDocument();
  });
});

// =========================================================================
// 9. humanizeLabel
// =========================================================================
import { humanizeLabel, PercentCellRenderer } from '../index';

describe('humanizeLabel', () => {
  it('should convert snake_case to Title Case', () => {
    expect(humanizeLabel('in_progress')).toBe('In Progress');
  });

  it('should convert kebab-case to Title Case', () => {
    expect(humanizeLabel('high-priority')).toBe('High Priority');
  });

  it('should handle single word', () => {
    expect(humanizeLabel('active')).toBe('Active');
  });

  it('should handle already Title Case', () => {
    expect(humanizeLabel('Active')).toBe('Active');
  });

  it('should handle multiple underscores', () => {
    expect(humanizeLabel('not_yet_started')).toBe('Not Yet Started');
  });

  it('should handle empty string', () => {
    expect(humanizeLabel('')).toBe('');
  });

  it('should handle mixed separators', () => {
    expect(humanizeLabel('in_progress-now')).toBe('In Progress Now');
  });
});

// =========================================================================
// 10. SelectCellRenderer humanizeLabel fallback
// =========================================================================
describe('SelectCellRenderer humanizeLabel fallback', () => {
  it('should humanize snake_case value when no option label exists', () => {
    render(
      <SelectCellRenderer
        value="in_progress"
        field={{ name: 'status', type: 'select', options: [] } as any}
      />
    );
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('should prefer explicit option.label over humanized fallback', () => {
    render(
      <SelectCellRenderer
        value="in_progress"
        field={{
          name: 'status',
          type: 'select',
          options: [{ value: 'in_progress', label: 'WIP' }],
        } as any}
      />
    );
    expect(screen.getByText('WIP')).toBeInTheDocument();
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
  });

  it('should humanize snake_case values in arrays', () => {
    render(
      <SelectCellRenderer
        value={['not_started', 'in_progress']}
        field={{ name: 'status', type: 'select', options: [] } as any}
      />
    );
    expect(screen.getByText('Not Started')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });
});

// =========================================================================
// 11. PercentCellRenderer with progress-type fields
// =========================================================================
describe('PercentCellRenderer progress-type fields', () => {
  it('should render progress field value 75 as 75% with correct bar', () => {
    const { container } = render(
      <PercentCellRenderer
        value={75}
        field={{ name: 'progress', type: 'percent' } as any}
      />
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toHaveAttribute('aria-valuenow', '75');
  });

  it('should render completion field value 50 as 50% with correct bar', () => {
    const { container } = render(
      <PercentCellRenderer
        value={50}
        field={{ name: 'completion', type: 'percent' } as any}
      />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('should render probability field value 0.75 as 75%', () => {
    const { container } = render(
      <PercentCellRenderer
        value={0.75}
        field={{ name: 'probability', type: 'percent' } as any}
      />
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toHaveAttribute('aria-valuenow', '75');
  });

  it('should render rate field value 0.5 as 50%', () => {
    const { container } = render(
      <PercentCellRenderer
        value={0.5}
        field={{ name: 'rate', type: 'percent' } as any}
      />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });
});
