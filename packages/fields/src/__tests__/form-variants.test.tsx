/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.2 Field Widget Polish - Form Variants
 *
 * Tests that field widgets work correctly in different form contexts:
 * standalone, multiple fields together, value changes, and controlled mode.
 */

import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TextField } from '../widgets/TextField';
import { NumberField } from '../widgets/NumberField';
import { EmailField } from '../widgets/EmailField';
import { BooleanField } from '../widgets/BooleanField';
import { TextAreaField } from '../widgets/TextAreaField';
import { CurrencyField } from '../widgets/CurrencyField';
import { UrlField } from '../widgets/UrlField';

const noop = vi.fn();

describe('P3.2 Form Variants', () => {
  // ---------------------------------------------------------------
  // Multiple fields rendered together
  // ---------------------------------------------------------------
  describe('multiple fields in a form', () => {
    it('renders multiple different field types side by side', () => {
      const { container } = render(
        <div>
          <TextField value="John" onChange={noop} field={{ type: 'text' } as any} />
          <EmailField value="john@test.com" onChange={noop} field={{ type: 'email' } as any} />
          <NumberField value={42} onChange={noop} field={{ type: 'number' } as any} />
          <BooleanField value={true} onChange={noop} field={{ type: 'boolean' } as any} />
        </div>
      );
      expect(screen.getAllByRole('textbox')).toHaveLength(2); // text + email
      expect(screen.getByRole('spinbutton')).toHaveValue(42);
      expect(screen.getByRole('switch')).toBeChecked();
    });

    it('each field maintains independent state via onChange', () => {
      const textChange = vi.fn();
      const numberChange = vi.fn();

      render(
        <div>
          <TextField value="" onChange={textChange} field={{ type: 'text' } as any} />
          <NumberField value={0} onChange={numberChange} field={{ type: 'number' } as any} />
        </div>
      );

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'hello' } });
      expect(textChange).toHaveBeenCalledWith('hello');
      expect(numberChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // Controlled component behavior
  // ---------------------------------------------------------------
  describe('controlled component behavior', () => {
    function ControlledTextField() {
      const [val, setVal] = useState('initial');
      return (
        <div>
          <TextField value={val} onChange={setVal} field={{ type: 'text' } as any} />
          <span data-testid="output">{val}</span>
        </div>
      );
    }

    it('TextField works as controlled component', () => {
      render(<ControlledTextField />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('initial');

      fireEvent.change(input, { target: { value: 'updated' } });
      expect(screen.getByTestId('output').textContent).toBe('updated');
    });

    function ControlledNumberField() {
      const [val, setVal] = useState(10);
      return (
        <div>
          <NumberField value={val} onChange={setVal} field={{ type: 'number' } as any} />
          <span data-testid="output">{String(val)}</span>
        </div>
      );
    }

    it('NumberField works as controlled component', () => {
      render(<ControlledNumberField />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(10);

      fireEvent.change(input, { target: { value: '25' } });
      expect(screen.getByTestId('output').textContent).toBe('25');
    });

    function ControlledBooleanField() {
      const [val, setVal] = useState(false);
      return (
        <div>
          <BooleanField value={val} onChange={setVal} field={{ type: 'boolean' } as any} />
          <span data-testid="output">{String(val)}</span>
        </div>
      );
    }

    it('BooleanField works as controlled component', () => {
      render(<ControlledBooleanField />);
      const toggle = screen.getByRole('switch');
      expect(toggle).not.toBeChecked();

      fireEvent.click(toggle);
      expect(screen.getByTestId('output').textContent).toBe('true');
    });
  });

  // ---------------------------------------------------------------
  // Switching between readonly and edit mode
  // ---------------------------------------------------------------
  describe('readonly/edit mode switching', () => {
    function ModeToggle() {
      const [ro, setRo] = useState(false);
      return (
        <div>
          <button data-testid="toggle" onClick={() => setRo(!ro)}>Toggle</button>
          <TextField value="hello" onChange={noop} field={{ type: 'text' } as any} readonly={ro} />
        </div>
      );
    }

    it('TextField switches from edit to readonly', () => {
      render(<ModeToggle />);
      // Start in edit mode
      expect(screen.getByRole('textbox')).toBeInTheDocument();

      // Toggle to readonly
      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.getByText('hello')).toBeInTheDocument();

      // Toggle back to edit
      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // TextField with rows (textarea variant)
  // ---------------------------------------------------------------
  describe('TextField textarea variant', () => {
    it('renders as textarea when rows > 1', () => {
      render(
        <TextField
          value="multi-line"
          onChange={noop}
          field={{ type: 'text', rows: 5 } as any}
        />
      );
      const el = screen.getByRole('textbox');
      expect(el.tagName).toBe('TEXTAREA');
    });

    it('renders as input when rows is not set', () => {
      render(
        <TextField
          value="single-line"
          onChange={noop}
          field={{ type: 'text' } as any}
        />
      );
      const el = screen.getByRole('textbox');
      expect(el.tagName).toBe('INPUT');
    });
  });

  // ---------------------------------------------------------------
  // TextAreaField with custom rows
  // ---------------------------------------------------------------
  describe('TextAreaField with custom rows', () => {
    it('uses custom rows from field metadata', () => {
      render(
        <TextAreaField
          value=""
          onChange={noop}
          field={{ type: 'textarea', rows: 10 } as any}
        />
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '10');
    });

    it('defaults to 4 rows', () => {
      render(
        <TextAreaField
          value=""
          onChange={noop}
          field={{ type: 'textarea' } as any}
        />
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '4');
    });
  });

  // ---------------------------------------------------------------
  // CurrencyField interaction
  // ---------------------------------------------------------------
  describe('CurrencyField interaction', () => {
    it('calls onChange with parsed number on input', () => {
      const onChange = vi.fn();
      render(
        <CurrencyField
          value={100}
          onChange={onChange}
          field={{ type: 'currency', currency: 'USD' } as any}
        />
      );
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '250.50' } });
      expect(onChange).toHaveBeenCalledWith(250.50);
    });

    it('calls onChange with null on empty input', () => {
      const onChange = vi.fn();
      render(
        <CurrencyField
          value={100}
          onChange={onChange}
          field={{ type: 'currency', currency: 'USD' } as any}
        />
      );
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('readonly mode formats currency value', () => {
      const { container } = render(
        <CurrencyField
          value={1234.56}
          onChange={noop}
          field={{ type: 'currency', currency: 'USD' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toMatch(/\$1,234\.56/);
    });
  });

  // ---------------------------------------------------------------
  // Email and URL readonly links
  // ---------------------------------------------------------------
  describe('readonly link generation', () => {
    it('EmailField generates mailto link in readonly', () => {
      render(
        <EmailField
          value="user@example.com"
          onChange={noop}
          field={{ type: 'email' } as any}
          readonly={true}
        />
      );
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'mailto:user@example.com');
    });

    it('UrlField generates external link in readonly', () => {
      render(
        <UrlField
          value="https://example.com"
          onChange={noop}
          field={{ type: 'url' } as any}
          readonly={true}
        />
      );
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('UrlField does not generate link for non-http URLs', () => {
      const { container } = render(
        <UrlField
          value="javascript:alert(1)"
          onChange={noop}
          field={{ type: 'url' } as any}
          readonly={true}
        />
      );
      expect(screen.queryByRole('link')).toBeNull();
      expect(container.textContent).toBe('javascript:alert(1)');
    });
  });
});
