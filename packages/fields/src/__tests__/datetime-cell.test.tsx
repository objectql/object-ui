/**
 * DateTimeCellRenderer Tests
 *
 * Tests for the Airtable-style split date/time cell renderer.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { DateTimeCellRenderer } from '../index';

describe('DateTimeCellRenderer', () => {
  it('should render date and time separately', () => {
    render(
      <DateTimeCellRenderer
        value="2026-02-18T12:57:00.000Z"
        field={{ name: 'created_at', type: 'datetime' } as any}
      />
    );
    // Date part should be visible
    expect(screen.getByText('2/18/2026')).toBeInTheDocument();
    // Time part should be in a muted span
    const container = screen.getByText('2/18/2026').closest('span');
    expect(container).toBeInTheDocument();
  });

  it('should show dash for null value', () => {
    const { container } = render(
      <DateTimeCellRenderer
        value={null}
        field={{ name: 'created_at', type: 'datetime' } as any}
      />
    );
    expect(container.textContent).toBe('-');
  });

  it('should show dash for invalid date', () => {
    const { container } = render(
      <DateTimeCellRenderer
        value="not-a-date"
        field={{ name: 'created_at', type: 'datetime' } as any}
      />
    );
    expect(container.textContent).toBe('-');
  });
});
