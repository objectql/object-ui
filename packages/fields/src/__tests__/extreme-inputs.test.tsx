/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.2 Field Widget Polish - Extreme Inputs
 *
 * Tests field widgets with extreme inputs: very long strings,
 * MAX_SAFE_INTEGER, emoji, RTL text, null/undefined values.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TextField } from '../widgets/TextField';
import { NumberField } from '../widgets/NumberField';
import { EmailField } from '../widgets/EmailField';
import { UrlField } from '../widgets/UrlField';
import { PhoneField } from '../widgets/PhoneField';
import { TextAreaField } from '../widgets/TextAreaField';
import { CurrencyField } from '../widgets/CurrencyField';
import { BooleanField } from '../widgets/BooleanField';
import { SelectField } from '../widgets/SelectField';

const noop = vi.fn();

describe('P3.2 Extreme Inputs', () => {
  // ---------------------------------------------------------------
  // Very long strings (10,000 chars)
  // ---------------------------------------------------------------
  describe('very long strings', () => {
    const longStr = 'x'.repeat(10000);

    it('TextField handles 10,000-char value', () => {
      render(
        <TextField
          value={longStr}
          onChange={noop}
          field={{ type: 'text' } as any}
        />
      );
      expect(screen.getByRole('textbox')).toHaveValue(longStr);
    });

    it('TextField readonly handles 10,000-char value', () => {
      const { container } = render(
        <TextField
          value={longStr}
          onChange={noop}
          field={{ type: 'text' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toHaveLength(10000);
    });

    it('EmailField handles long email value', () => {
      const longEmail = 'a'.repeat(200) + '@example.com';
      render(
        <EmailField
          value={longEmail}
          onChange={noop}
          field={{ type: 'email' } as any}
        />
      );
      expect(screen.getByDisplayValue(longEmail)).toBeInTheDocument();
    });

    it('TextAreaField handles 10,000-char value', () => {
      render(
        <TextAreaField
          value={longStr}
          onChange={noop}
          field={{ type: 'textarea' } as any}
        />
      );
      expect(screen.getByRole('textbox')).toHaveValue(longStr);
    });

    it('UrlField handles long URL value', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(5000);
      render(
        <UrlField
          value={longUrl}
          onChange={noop}
          field={{ type: 'url' } as any}
        />
      );
      expect(screen.getByDisplayValue(longUrl)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Numeric extremes
  // ---------------------------------------------------------------
  describe('numeric extremes', () => {
    it('NumberField handles MAX_SAFE_INTEGER', () => {
      render(
        <NumberField
          value={Number.MAX_SAFE_INTEGER}
          onChange={noop}
          field={{ type: 'number' } as any}
        />
      );
      expect(screen.getByRole('spinbutton')).toHaveValue(Number.MAX_SAFE_INTEGER);
    });

    it('NumberField handles negative MAX_SAFE_INTEGER', () => {
      render(
        <NumberField
          value={-Number.MAX_SAFE_INTEGER}
          onChange={noop}
          field={{ type: 'number' } as any}
        />
      );
      expect(screen.getByRole('spinbutton')).toHaveValue(-Number.MAX_SAFE_INTEGER);
    });

    it('NumberField handles 0', () => {
      render(
        <NumberField
          value={0}
          onChange={noop}
          field={{ type: 'number' } as any}
        />
      );
      expect(screen.getByRole('spinbutton')).toHaveValue(0);
    });

    it('NumberField readonly handles MAX_SAFE_INTEGER', () => {
      const { container } = render(
        <NumberField
          value={Number.MAX_SAFE_INTEGER}
          onChange={noop}
          field={{ type: 'number' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe(String(Number.MAX_SAFE_INTEGER));
    });

    it('CurrencyField handles large value', () => {
      render(
        <CurrencyField
          value={9999999.99}
          onChange={noop}
          field={{ type: 'currency', currency: 'USD' } as any}
        />
      );
      expect(screen.getByRole('spinbutton')).toHaveValue(9999999.99);
    });

    it('CurrencyField handles 0', () => {
      render(
        <CurrencyField
          value={0}
          onChange={noop}
          field={{ type: 'currency', currency: 'USD' } as any}
        />
      );
      expect(screen.getByRole('spinbutton')).toHaveValue(0);
    });

    it('NumberField fires onChange with empty string -> null', () => {
      const onChange = vi.fn();
      render(
        <NumberField
          value={42}
          onChange={onChange}
          field={{ type: 'number' } as any}
        />
      );
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  // ---------------------------------------------------------------
  // Emoji and special unicode
  // ---------------------------------------------------------------
  describe('emoji and unicode', () => {
    it('TextField handles emoji input', () => {
      render(
        <TextField
          value="🚀🎉🔥"
          onChange={noop}
          field={{ type: 'text' } as any}
        />
      );
      expect(screen.getByRole('textbox')).toHaveValue('🚀🎉🔥');
    });

    it('TextField readonly handles emoji', () => {
      const { container } = render(
        <TextField
          value="Hello 🌍"
          onChange={noop}
          field={{ type: 'text' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('Hello 🌍');
    });

    it('TextAreaField handles emoji', () => {
      render(
        <TextAreaField
          value="Notes: 📝✅❌"
          onChange={noop}
          field={{ type: 'textarea' } as any}
        />
      );
      expect(screen.getByRole('textbox')).toHaveValue('Notes: 📝✅❌');
    });

    it('PhoneField handles unicode value', () => {
      render(
        <PhoneField
          value="+1 (555) 123-4567"
          onChange={noop}
          field={{ type: 'phone' } as any}
        />
      );
      expect(screen.getByDisplayValue('+1 (555) 123-4567')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // RTL text
  // ---------------------------------------------------------------
  describe('RTL text', () => {
    const arabicText = 'مرحبا بالعالم';

    it('TextField handles RTL text', () => {
      render(
        <TextField
          value={arabicText}
          onChange={noop}
          field={{ type: 'text' } as any}
        />
      );
      expect(screen.getByRole('textbox')).toHaveValue(arabicText);
    });

    it('TextField readonly handles RTL text', () => {
      const { container } = render(
        <TextField
          value={arabicText}
          onChange={noop}
          field={{ type: 'text' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe(arabicText);
    });

    it('TextAreaField handles RTL text', () => {
      render(
        <TextAreaField
          value={arabicText}
          onChange={noop}
          field={{ type: 'textarea' } as any}
        />
      );
      expect(screen.getByRole('textbox')).toHaveValue(arabicText);
    });
  });

  // ---------------------------------------------------------------
  // Null and undefined values
  // ---------------------------------------------------------------
  describe('null and undefined values', () => {
    it('TextField treats null as empty string', () => {
      render(
        <TextField
          value={null as any}
          onChange={noop}
          field={{ type: 'text' } as any}
        />
      );
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('NumberField treats null as empty', () => {
      render(
        <NumberField
          value={null as any}
          onChange={noop}
          field={{ type: 'number' } as any}
        />
      );
      // null ?? '' -> '' which means no value
      expect(screen.getByRole('spinbutton')).toHaveValue(null);
    });

    it('EmailField treats null as empty', () => {
      render(
        <EmailField
          value={null as any}
          onChange={noop}
          field={{ type: 'email' } as any}
        />
      );
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('CurrencyField treats null as empty', () => {
      render(
        <CurrencyField
          value={null as any}
          onChange={noop}
          field={{ type: 'currency' } as any}
        />
      );
      expect(screen.getByRole('spinbutton')).toHaveValue(null);
    });

    it('BooleanField treats null as false', () => {
      render(
        <BooleanField
          value={null as any}
          onChange={noop}
          field={{ type: 'boolean' } as any}
        />
      );
      expect(screen.getByRole('switch')).not.toBeChecked();
    });

    it('SelectField treats null as empty', () => {
      render(
        <SelectField
          value={null as any}
          onChange={noop}
          field={{ type: 'select', options: [{ label: 'A', value: 'a' }] } as any}
        />
      );
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // TextAreaField character counter
  // ---------------------------------------------------------------
  describe('TextAreaField character counter', () => {
    it('shows character count when max_length is set', () => {
      render(
        <TextAreaField
          value="Hello"
          onChange={noop}
          field={{ type: 'textarea', max_length: 100 } as any}
        />
      );
      expect(screen.getByText('5/100')).toBeInTheDocument();
    });

    it('shows count at max_length limit', () => {
      const maxStr = 'a'.repeat(50);
      render(
        <TextAreaField
          value={maxStr}
          onChange={noop}
          field={{ type: 'textarea', max_length: 50 } as any}
        />
      );
      expect(screen.getByText('50/50')).toBeInTheDocument();
    });

    it('does not show count without max_length', () => {
      const { container } = render(
        <TextAreaField
          value="Hello"
          onChange={noop}
          field={{ type: 'textarea' } as any}
        />
      );
      expect(container.querySelector('[aria-live="polite"]')).toBeNull();
    });
  });
});
