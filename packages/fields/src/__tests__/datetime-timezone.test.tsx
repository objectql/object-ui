/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.2 Field Widget Polish - Date/Time Timezone & Locale Formatting
 *
 * Tests date, time, and datetime picker fields for timezone edge cases,
 * locale formatting in readonly mode, and boundary conditions like
 * midnight, end-of-day, leap years, and DST transitions.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DateField } from '../widgets/DateField';
import { TimeField } from '../widgets/TimeField';
import { DateTimeField } from '../widgets/DateTimeField';

const noop = vi.fn();

describe('P3.2 Date/Time Timezone & Locale Formatting', () => {
  // ---------------------------------------------------------------
  // DateField with various ISO date strings
  // ---------------------------------------------------------------
  describe('DateField ISO date strings', () => {
    it('handles start-of-year date 2024-01-01', () => {
      render(
        <DateField
          value="2024-01-01"
          onChange={noop}
          field={{ type: 'date' } as any}
        />
      );
      expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument();
    });

    it('handles end-of-year date 2024-12-31', () => {
      render(
        <DateField
          value="2024-12-31"
          onChange={noop}
          field={{ type: 'date' } as any}
        />
      );
      expect(screen.getByDisplayValue('2024-12-31')).toBeInTheDocument();
    });

    it('handles leap year date 2024-02-29', () => {
      render(
        <DateField
          value="2024-02-29"
          onChange={noop}
          field={{ type: 'date' } as any}
        />
      );
      expect(screen.getByDisplayValue('2024-02-29')).toBeInTheDocument();
    });

    it('fires onChange with new date value', () => {
      const onChange = vi.fn();
      render(
        <DateField
          value="2024-01-01"
          onChange={onChange}
          field={{ type: 'date' } as any}
        />
      );
      fireEvent.change(screen.getByDisplayValue('2024-01-01'), {
        target: { value: '2024-06-15' },
      });
      expect(onChange).toHaveBeenCalledWith('2024-06-15');
    });
  });

  // ---------------------------------------------------------------
  // DateField readonly locale formatting
  // ---------------------------------------------------------------
  describe('DateField readonly locale formatting', () => {
    it('displays locale-formatted date for 2024-01-01', () => {
      const { container } = render(
        <DateField
          value="2024-01-01"
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      const expected = new Date('2024-01-01').toLocaleDateString();
      expect(container.textContent).toBe(expected);
    });

    it('displays locale-formatted date for 2024-12-31', () => {
      const { container } = render(
        <DateField
          value="2024-12-31"
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      const expected = new Date('2024-12-31').toLocaleDateString();
      expect(container.textContent).toBe(expected);
    });

    it('displays locale-formatted date for leap year 2024-02-29', () => {
      const { container } = render(
        <DateField
          value="2024-02-29"
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      const expected = new Date('2024-02-29').toLocaleDateString();
      expect(container.textContent).toBe(expected);
    });
  });

  // ---------------------------------------------------------------
  // TimeField with various time strings
  // ---------------------------------------------------------------
  describe('TimeField time strings', () => {
    it('handles midnight 00:00', () => {
      render(
        <TimeField
          value="00:00"
          onChange={noop}
          field={{ type: 'time' } as any}
        />
      );
      expect(screen.getByDisplayValue('00:00')).toBeInTheDocument();
    });

    it('handles midday 12:30', () => {
      render(
        <TimeField
          value="12:30"
          onChange={noop}
          field={{ type: 'time' } as any}
        />
      );
      expect(screen.getByDisplayValue('12:30')).toBeInTheDocument();
    });

    it('handles end-of-day 23:59', () => {
      render(
        <TimeField
          value="23:59"
          onChange={noop}
          field={{ type: 'time' } as any}
        />
      );
      expect(screen.getByDisplayValue('23:59')).toBeInTheDocument();
    });

    it('handles time with seconds 14:30:45', () => {
      render(
        <TimeField
          value="14:30:45"
          onChange={noop}
          field={{ type: 'time' } as any}
        />
      );
      expect(screen.getByDisplayValue('14:30:45')).toBeInTheDocument();
    });

    it('fires onChange with new time value', () => {
      const onChange = vi.fn();
      render(
        <TimeField
          value="12:30"
          onChange={onChange}
          field={{ type: 'time' } as any}
        />
      );
      fireEvent.change(screen.getByDisplayValue('12:30'), {
        target: { value: '09:15' },
      });
      expect(onChange).toHaveBeenCalledWith('09:15');
    });
  });

  // ---------------------------------------------------------------
  // TimeField readonly display
  // ---------------------------------------------------------------
  describe('TimeField readonly display', () => {
    it('displays time value directly in readonly', () => {
      const { container } = render(
        <TimeField
          value="14:30"
          onChange={noop}
          field={{ type: 'time' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('14:30');
    });

    it('displays midnight in readonly', () => {
      const { container } = render(
        <TimeField
          value="00:00"
          onChange={noop}
          field={{ type: 'time' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('00:00');
    });

    it('displays end-of-day in readonly', () => {
      const { container } = render(
        <TimeField
          value="23:59"
          onChange={noop}
          field={{ type: 'time' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('23:59');
    });
  });

  // ---------------------------------------------------------------
  // DateTimeField with ISO datetime strings
  // ---------------------------------------------------------------
  describe('DateTimeField ISO datetime strings', () => {
    it('handles datetime-local format', () => {
      render(
        <DateTimeField
          value="2024-01-01T00:00"
          onChange={noop}
          field={{ type: 'datetime' } as any}
        />
      );
      expect(screen.getByDisplayValue('2024-01-01T00:00')).toBeInTheDocument();
    });

    it('handles datetime with seconds', () => {
      const { container } = render(
        <DateTimeField
          value="2024-06-15T14:30:00"
          onChange={noop}
          field={{ type: 'datetime' } as any}
        />
      );
      // datetime-local inputs may normalize seconds away
      const input = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toMatch(/^2024-06-15T14:30/);
    });

    it('handles end-of-year datetime', () => {
      render(
        <DateTimeField
          value="2024-12-31T23:59"
          onChange={noop}
          field={{ type: 'datetime' } as any}
        />
      );
      expect(screen.getByDisplayValue('2024-12-31T23:59')).toBeInTheDocument();
    });

    it('fires onChange with new datetime value', () => {
      const onChange = vi.fn();
      render(
        <DateTimeField
          value="2024-01-01T00:00"
          onChange={onChange}
          field={{ type: 'datetime' } as any}
        />
      );
      fireEvent.change(screen.getByDisplayValue('2024-01-01T00:00'), {
        target: { value: '2024-07-04T12:00' },
      });
      expect(onChange).toHaveBeenCalledWith('2024-07-04T12:00');
    });
  });

  // ---------------------------------------------------------------
  // DateTimeField readonly locale formatting
  // ---------------------------------------------------------------
  describe('DateTimeField readonly locale formatting', () => {
    it('displays locale-formatted date and time', () => {
      const value = '2024-06-15T14:30:00';
      const { container } = render(
        <DateTimeField
          value={value}
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      const date = new Date(value);
      const expected = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      expect(container.textContent).toBe(expected);
    });

    it('displays locale-formatted midnight datetime', () => {
      const value = '2024-01-01T00:00:00';
      const { container } = render(
        <DateTimeField
          value={value}
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      const date = new Date(value);
      const expected = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      expect(container.textContent).toBe(expected);
    });

    it('displays locale-formatted end-of-day datetime', () => {
      const value = '2024-12-31T23:59:59';
      const { container } = render(
        <DateTimeField
          value={value}
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      const date = new Date(value);
      const expected = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      expect(container.textContent).toBe(expected);
    });
  });

  // ---------------------------------------------------------------
  // Empty, null, and undefined values show placeholder "-"
  // ---------------------------------------------------------------
  describe('empty/null/undefined values', () => {
    it('DateField readonly shows "-" for empty string', () => {
      const { container } = render(
        <DateField
          value=""
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('DateField readonly shows "-" for null', () => {
      const { container } = render(
        <DateField
          value={null as any}
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('DateField readonly shows "-" for undefined', () => {
      const { container } = render(
        <DateField
          value={undefined as any}
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('TimeField readonly shows "-" for empty string', () => {
      const { container } = render(
        <TimeField
          value=""
          onChange={noop}
          field={{ type: 'time' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('TimeField readonly shows "-" for null', () => {
      const { container } = render(
        <TimeField
          value={null as any}
          onChange={noop}
          field={{ type: 'time' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('TimeField readonly shows "-" for undefined', () => {
      const { container } = render(
        <TimeField
          value={undefined as any}
          onChange={noop}
          field={{ type: 'time' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('DateTimeField readonly shows "-" for empty string', () => {
      const { container } = render(
        <DateTimeField
          value=""
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('DateTimeField readonly shows "-" for null', () => {
      const { container } = render(
        <DateTimeField
          value={null as any}
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('DateTimeField readonly shows "-" for undefined', () => {
      const { container } = render(
        <DateTimeField
          value={undefined as any}
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('DateField editable uses empty string for null value', () => {
      render(
        <DateField
          value={null as any}
          onChange={noop}
          field={{ type: 'date' } as any}
        />
      );
      const input = screen.getByDisplayValue('');
      expect(input).toBeInTheDocument();
    });

    it('TimeField editable uses empty string for null value', () => {
      render(
        <TimeField
          value={null as any}
          onChange={noop}
          field={{ type: 'time' } as any}
        />
      );
      const input = screen.getByDisplayValue('');
      expect(input).toBeInTheDocument();
    });

    it('DateTimeField editable uses empty string for null value', () => {
      render(
        <DateTimeField
          value={null as any}
          onChange={noop}
          field={{ type: 'datetime' } as any}
        />
      );
      const input = screen.getByDisplayValue('');
      expect(input).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Invalid date strings handled gracefully
  // ---------------------------------------------------------------
  describe('invalid date strings', () => {
    it('DateField readonly handles invalid date string', () => {
      const { container } = render(
        <DateField
          value="not-a-date"
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      // new Date('not-a-date').toLocaleDateString() produces 'Invalid Date'
      const expected = new Date('not-a-date').toLocaleDateString();
      expect(container.textContent).toBe(expected);
    });

    it('DateTimeField readonly handles invalid datetime string', () => {
      const { container } = render(
        <DateTimeField
          value="garbage-datetime"
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      const date = new Date('garbage-datetime');
      const expected = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      expect(container.textContent).toBe(expected);
    });

    it('DateField editable renders input for invalid value without crashing', () => {
      const { container } = render(
        <DateField
          value="not-a-date"
          onChange={noop}
          field={{ type: 'date' } as any}
        />
      );
      const input = container.querySelector('input[type="date"]');
      expect(input).toBeInTheDocument();
    });

    it('TimeField editable renders input for invalid value without crashing', () => {
      const { container } = render(
        <TimeField
          value="invalid-time"
          onChange={noop}
          field={{ type: 'time' } as any}
        />
      );
      const input = container.querySelector('input[type="time"]');
      expect(input).toBeInTheDocument();
    });

    it('DateTimeField editable renders input for invalid value without crashing', () => {
      const { container } = render(
        <DateTimeField
          value="invalid-datetime"
          onChange={noop}
          field={{ type: 'datetime' } as any}
        />
      );
      const input = container.querySelector('input[type="datetime-local"]');
      expect(input).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Midnight and end-of-day edge cases
  // ---------------------------------------------------------------
  describe('midnight and end-of-day edge cases', () => {
    it('DateTimeField handles midnight correctly', () => {
      const value = '2024-03-15T00:00:00';
      const { container } = render(
        <DateTimeField
          value={value}
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      const date = new Date(value);
      const expected = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      expect(container.textContent).toBe(expected);
    });

    it('DateTimeField handles 23:59:59 correctly', () => {
      const value = '2024-03-15T23:59:59';
      const { container } = render(
        <DateTimeField
          value={value}
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      const date = new Date(value);
      const expected = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      expect(container.textContent).toBe(expected);
    });

    it('TimeField handles midnight 00:00 in editable mode', () => {
      render(
        <TimeField
          value="00:00"
          onChange={noop}
          field={{ type: 'time' } as any}
        />
      );
      expect(screen.getByDisplayValue('00:00')).toBeInTheDocument();
    });

    it('TimeField handles one-second-to-midnight 23:59:59', () => {
      render(
        <TimeField
          value="23:59:59"
          onChange={noop}
          field={{ type: 'time' } as any}
        />
      );
      expect(screen.getByDisplayValue('23:59:59')).toBeInTheDocument();
    });

    it('DateField handles New Year boundary', () => {
      const { container } = render(
        <DateField
          value="2024-01-01"
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      const expected = new Date('2024-01-01').toLocaleDateString();
      expect(container.textContent).toBe(expected);
    });
  });

  // ---------------------------------------------------------------
  // DST boundary dates
  // ---------------------------------------------------------------
  describe('DST boundary dates', () => {
    it('DateField handles US spring-forward date (March 10, 2024)', () => {
      render(
        <DateField
          value="2024-03-10"
          onChange={noop}
          field={{ type: 'date' } as any}
        />
      );
      expect(screen.getByDisplayValue('2024-03-10')).toBeInTheDocument();
    });

    it('DateField readonly handles US spring-forward date', () => {
      const { container } = render(
        <DateField
          value="2024-03-10"
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      const expected = new Date('2024-03-10').toLocaleDateString();
      expect(container.textContent).toBe(expected);
    });

    it('DateField handles US fall-back date (November 3, 2024)', () => {
      render(
        <DateField
          value="2024-11-03"
          onChange={noop}
          field={{ type: 'date' } as any}
        />
      );
      expect(screen.getByDisplayValue('2024-11-03')).toBeInTheDocument();
    });

    it('DateField readonly handles US fall-back date', () => {
      const { container } = render(
        <DateField
          value="2024-11-03"
          onChange={noop}
          field={{ type: 'date' } as any}
          readonly={true}
        />
      );
      const expected = new Date('2024-11-03').toLocaleDateString();
      expect(container.textContent).toBe(expected);
    });

    it('DateTimeField handles spring-forward at 2:00 AM', () => {
      const value = '2024-03-10T02:00:00';
      const { container } = render(
        <DateTimeField
          value={value}
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      const date = new Date(value);
      const expected = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      expect(container.textContent).toBe(expected);
    });

    it('DateTimeField handles fall-back at 1:00 AM', () => {
      const value = '2024-11-03T01:00:00';
      const { container } = render(
        <DateTimeField
          value={value}
          onChange={noop}
          field={{ type: 'datetime' } as any}
          readonly={true}
        />
      );
      const date = new Date(value);
      const expected = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      expect(container.textContent).toBe(expected);
    });

    it('DateTimeField editable handles spring-forward datetime', () => {
      render(
        <DateTimeField
          value="2024-03-10T02:30"
          onChange={noop}
          field={{ type: 'datetime' } as any}
        />
      );
      expect(screen.getByDisplayValue('2024-03-10T02:30')).toBeInTheDocument();
    });

    it('DateTimeField editable handles fall-back datetime', () => {
      render(
        <DateTimeField
          value="2024-11-03T01:30"
          onChange={noop}
          field={{ type: 'datetime' } as any}
        />
      );
      expect(screen.getByDisplayValue('2024-11-03T01:30')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Disabled state
  // ---------------------------------------------------------------
  describe('disabled state', () => {
    it('DateField is disabled when disabled prop is set', () => {
      render(
        <DateField
          value="2024-01-01"
          onChange={noop}
          field={{ type: 'date' } as any}
          disabled={true}
        />
      );
      expect(screen.getByDisplayValue('2024-01-01')).toBeDisabled();
    });

    it('TimeField is disabled when disabled prop is set', () => {
      render(
        <TimeField
          value="12:30"
          onChange={noop}
          field={{ type: 'time' } as any}
          disabled={true}
        />
      );
      expect(screen.getByDisplayValue('12:30')).toBeDisabled();
    });

    it('DateTimeField is disabled when disabled prop is set', () => {
      render(
        <DateTimeField
          value="2024-01-01T00:00"
          onChange={noop}
          field={{ type: 'datetime' } as any}
          disabled={true}
        />
      );
      expect(screen.getByDisplayValue('2024-01-01T00:00')).toBeDisabled();
    });
  });
});
