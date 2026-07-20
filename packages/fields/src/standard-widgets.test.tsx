/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CurrencyField } from './widgets/CurrencyField';
import { NumberField } from './widgets/NumberField';
import { TextField } from './widgets/TextField';
import { SelectField } from './widgets/SelectField';
import { BooleanField } from './widgets/BooleanField';
import { DateField } from './widgets/DateField';
import { EmailField } from './widgets/EmailField';
import { UrlField } from './widgets/UrlField';
import { PhoneField } from './widgets/PhoneField';
import { TextAreaField } from './widgets/TextAreaField';

const mockOnChange = vi.fn();

describe('Standard Field Widgets', () => {
  describe('CurrencyField', () => {
    const fieldMock = { type: 'currency', currency: 'USD', precision: 2 };

    it('should render value with currency symbol in input mode', () => {
      render(
        <CurrencyField
          value={123.45}
          onChange={mockOnChange}
          field={fieldMock as any}
        />
      );
      const input = screen.getByRole('spinbutton'); // input type="number"
      expect(input).toHaveValue(123.45);
      expect(screen.getByText('$')).toBeInTheDocument();
    });

    it('should format currency in readonly mode', () => {
      const { container } = render(
        <CurrencyField
          value={1234.56}
          onChange={mockOnChange}
          field={fieldMock as any}
          readonly={true}
        />
      );
      // Expected output format might depend on locale, matching generic USD format
      expect(container.textContent).toMatch(/\$1,234.56/);
    });

    it('should handle EUR currency', () => {
      render(
        <CurrencyField
          value={100}
          onChange={mockOnChange}
          field={{ ...fieldMock, currency: 'EUR' } as any}
        />
      );
      expect(screen.getByText('EUR')).toBeInTheDocument();
    });
  });

  describe('NumberField', () => {
    const fieldMock = { type: 'number', precision: 2 };

    it('should render numeric input', () => {
      render(
        <NumberField
          value={42}
          onChange={mockOnChange}
          field={fieldMock as any}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(42);
    });

    it('should call onChange with number', () => {
      render(
        <NumberField
          value={1}
          onChange={mockOnChange}
          field={fieldMock as any}
        />
      );
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '10' } });
      expect(mockOnChange).toHaveBeenCalledWith(10);
    });

    it('should display value in readonly mode', () => {
      const { container } = render(
        <NumberField
          value={99.9}
          onChange={mockOnChange}
          field={fieldMock as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('99.9');
    });

    it('should surface metadata min/max on the input (objectui#2572)', () => {
      render(
        <NumberField
          value={5}
          onChange={mockOnChange}
          field={{ type: 'number', min: 0, max: 100 } as any}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });

    it('should step by 1 for scale: 0 (whole numbers), not "any"', () => {
      render(
        <NumberField
          value={5}
          onChange={mockOnChange}
          field={{ type: 'number', scale: 0 } as any}
        />
      );
      expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '1');
    });

    it('should honor an explicit metadata step over the scale-derived one', () => {
      render(
        <NumberField
          value={5}
          onChange={mockOnChange}
          field={{ type: 'number', scale: 2, step: 5 } as any}
        />
      );
      expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '5');
    });
  });

  describe('TextField', () => {
    const fieldMock = { type: 'text' };

    it('should render text input', () => {
      render(
        <TextField
          value="Hello"
          onChange={mockOnChange}
          field={fieldMock as any}
        />
      );
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('Hello');
    });

    it('should render as password when type is password', () => {
        render(
          <TextField
            value="secret"
            onChange={mockOnChange}
            field={{ type: 'password' } as any}
          />
        );
        // getByRole('textbox') doesn't work for password type usually
        const input = screen.getByDisplayValue('secret'); 
        expect(input).toHaveAttribute('type', 'password');
      });

    it('should display value in readonly mode', () => {
      const { container } = render(
        <TextField
          value="ReadOnly"
          onChange={mockOnChange}
          field={fieldMock as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('ReadOnly');
    });
  });

  describe('SelectField', () => {
    const fieldMock = { 
        type: 'select', 
        options: [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' }
        ] 
    };

    it('should render select trigger (Combobox/Select)', () => {
      render(
        <SelectField
          value={''}
          onChange={mockOnChange}
          field={fieldMock as any}
        />
      );
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should display label in readonly mode', () => {
      const { container } = render(
        <SelectField
          value="a"
          onChange={mockOnChange}
          field={fieldMock as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('Option A');
    });

    // A `select` declared `multiple` is a multi-value picker (spec allows
    // `multiple` on select). SelectField delegates to the chip picker so the
    // form, inline editor, and ActionParamDialog all get multi-select from the
    // one `select` widget — no single-select fallback, no per-surface drift.
    it('renders the multi-value chip picker when field.multiple is set', () => {
      render(
        <SelectField
          value={['a']}
          onChange={mockOnChange}
          field={{ ...fieldMock, multiple: true } as any}
        />
      );
      // Chip picker uses toggle buttons (aria-pressed), not a Radix combobox.
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      const optionA = screen.getByRole('button', { name: 'Option A' });
      expect(optionA).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Option B' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('multi-select toggles values as an array', () => {
      render(
        <SelectField
          value={['a']}
          onChange={mockOnChange}
          field={{ ...fieldMock, multiple: true } as any}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Option B' }));
      expect(mockOnChange).toHaveBeenCalledWith(['a', 'b']);
    });

    it('multi-select renders selected values as badges in readonly mode', () => {
      const { container } = render(
        <SelectField
          value={['a', 'b']}
          onChange={mockOnChange}
          field={{ ...fieldMock, multiple: true } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toContain('Option A');
      expect(container.textContent).toContain('Option B');
    });
  });

  describe('BooleanField', () => {
    const fieldMock = { type: 'boolean' };

    it('should render checkbox/switch', () => {
      render(
        <BooleanField
          value={true}
          onChange={mockOnChange}
          field={fieldMock as any}
        />
      );
      // Ensure we can find the switch role (Shadcn switch uses role="switch")
      expect(screen.getByRole('switch')).toBeChecked();
    });

    it('should toggle value', () => {
      render(
        <BooleanField
          value={false}
          onChange={mockOnChange}
          field={fieldMock as any}
        />
      );
      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);
      expect(mockOnChange).toHaveBeenCalledWith(true);
    });

    it('should display Yes/No in readonly mode', () => {
       const { container } = render(
        <BooleanField
          value={true}
          onChange={mockOnChange}
          field={fieldMock as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('Yes');
    });
  });

  describe('EmailField', () => {
    it('should render email input', () => {
      render(
        <EmailField
          value="test@example.com"
          onChange={mockOnChange}
          field={{ type: 'email' } as any}
        />
      );
      const input = screen.getByDisplayValue('test@example.com');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('should render as link in readonly mode', () => {
      render(
        <EmailField
          value="test@example.com"
          onChange={mockOnChange}
          field={{ type: 'email' } as any}
          readonly={true}
        />
      );
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'mailto:test@example.com');
      expect(link).toHaveTextContent('test@example.com');
    });
  });

  describe('UrlField', () => {
    it('should render url input', () => {
      render(
        <UrlField
          value="https://example.com"
          onChange={mockOnChange}
          field={{ type: 'url' } as any}
        />
      );
      const input = screen.getByDisplayValue('https://example.com');
      expect(input).toHaveAttribute('type', 'url');
    });

    it('should render clickable link in readonly mode', () => {
      render(
        <UrlField
          value="https://example.com"
          onChange={mockOnChange}
          field={{ type: 'url' } as any}
          readonly={true}
        />
      );
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });
});
