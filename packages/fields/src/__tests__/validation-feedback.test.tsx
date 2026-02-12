/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.2 Field Widget Polish - Validation Feedback
 *
 * Tests that field widgets consistently handle validation feedback:
 * errorMessage prop, aria-invalid attribute, and disabled states.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
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

describe('P3.2 Validation Feedback', () => {
  // ---------------------------------------------------------------
  // aria-invalid on errorMessage
  // ---------------------------------------------------------------
  describe('aria-invalid attribute', () => {
    it('EmailField sets aria-invalid when errorMessage provided', () => {
      render(
        <EmailField
          value=""
          onChange={noop}
          field={{ type: 'email' } as any}
          errorMessage="Invalid email"
        />
      );
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('EmailField does not set aria-invalid without errorMessage', () => {
      render(
        <EmailField
          value=""
          onChange={noop}
          field={{ type: 'email' } as any}
        />
      );
      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('UrlField sets aria-invalid when errorMessage provided', () => {
      render(
        <UrlField
          value=""
          onChange={noop}
          field={{ type: 'url' } as any}
          errorMessage="Invalid URL"
        />
      );
      const input = screen.getByDisplayValue('');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('PhoneField sets aria-invalid when errorMessage provided', () => {
      render(
        <PhoneField
          value=""
          onChange={noop}
          field={{ type: 'phone' } as any}
          errorMessage="Invalid phone"
        />
      );
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('TextAreaField sets aria-invalid when errorMessage provided', () => {
      render(
        <TextAreaField
          value=""
          onChange={noop}
          field={{ type: 'textarea' } as any}
          errorMessage="Required"
        />
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });

    it('CurrencyField sets aria-invalid when errorMessage provided', () => {
      render(
        <CurrencyField
          value={0}
          onChange={noop}
          field={{ type: 'currency' } as any}
          errorMessage="Must be positive"
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  // ---------------------------------------------------------------
  // Disabled state consistency
  // ---------------------------------------------------------------
  describe('disabled state', () => {
    it('TextField supports disabled prop', () => {
      render(
        <TextField
          value="test"
          onChange={noop}
          field={{ type: 'text' } as any}
          disabled={true}
        />
      );
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('NumberField supports disabled prop', () => {
      render(
        <NumberField
          value={5}
          onChange={noop}
          field={{ type: 'number' } as any}
          disabled={true}
        />
      );
      expect(screen.getByRole('spinbutton')).toBeDisabled();
    });

    it('EmailField supports disabled prop', () => {
      render(
        <EmailField
          value=""
          onChange={noop}
          field={{ type: 'email' } as any}
          disabled={true}
        />
      );
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('PhoneField supports disabled prop', () => {
      render(
        <PhoneField
          value=""
          onChange={noop}
          field={{ type: 'phone' } as any}
          disabled={true}
        />
      );
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('TextAreaField supports disabled prop', () => {
      render(
        <TextAreaField
          value=""
          onChange={noop}
          field={{ type: 'textarea' } as any}
          disabled={true}
        />
      );
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------
  // Readonly mode consistency
  // ---------------------------------------------------------------
  describe('readonly mode output', () => {
    it('TextField shows dash for empty value in readonly', () => {
      const { container } = render(
        <TextField
          value=""
          onChange={noop}
          field={{ type: 'text' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('NumberField shows dash for null value in readonly', () => {
      const { container } = render(
        <NumberField
          value={null as any}
          onChange={noop}
          field={{ type: 'number' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('EmailField shows dash for empty value in readonly', () => {
      const { container } = render(
        <EmailField
          value=""
          onChange={noop}
          field={{ type: 'email' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('UrlField shows dash for empty value in readonly', () => {
      const { container } = render(
        <UrlField
          value=""
          onChange={noop}
          field={{ type: 'url' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('PhoneField shows dash for empty value in readonly', () => {
      const { container } = render(
        <PhoneField
          value=""
          onChange={noop}
          field={{ type: 'phone' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('TextAreaField shows dash for empty value in readonly', () => {
      const { container } = render(
        <TextAreaField
          value=""
          onChange={noop}
          field={{ type: 'textarea' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('BooleanField shows Yes/No in readonly', () => {
      const { container: yesC } = render(
        <BooleanField
          value={true}
          onChange={noop}
          field={{ type: 'boolean' } as any}
          readonly={true}
        />
      );
      expect(yesC.textContent).toBe('Yes');

      const { container: noC } = render(
        <BooleanField
          value={false}
          onChange={noop}
          field={{ type: 'boolean' } as any}
          readonly={true}
        />
      );
      expect(noC.textContent).toBe('No');
    });

    it('SelectField shows dash for empty value in readonly', () => {
      const { container } = render(
        <SelectField
          value=""
          onChange={noop}
          field={{ type: 'select', options: [] } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });

    it('CurrencyField shows dash for null value in readonly', () => {
      const { container } = render(
        <CurrencyField
          value={null as any}
          onChange={noop}
          field={{ type: 'currency' } as any}
          readonly={true}
        />
      );
      expect(container.textContent).toBe('-');
    });
  });

  // ---------------------------------------------------------------
  // Placeholder consistency
  // ---------------------------------------------------------------
  describe('placeholder support', () => {
    it('TextField uses field placeholder', () => {
      render(
        <TextField
          value=""
          onChange={noop}
          field={{ type: 'text', placeholder: 'Enter name...' } as any}
        />
      );
      expect(screen.getByPlaceholderText('Enter name...')).toBeInTheDocument();
    });

    it('EmailField uses default placeholder', () => {
      render(
        <EmailField
          value=""
          onChange={noop}
          field={{ type: 'email' } as any}
        />
      );
      expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
    });

    it('UrlField uses default placeholder', () => {
      render(
        <UrlField
          value=""
          onChange={noop}
          field={{ type: 'url' } as any}
        />
      );
      expect(screen.getByPlaceholderText('https://example.com')).toBeInTheDocument();
    });

    it('PhoneField uses default placeholder', () => {
      render(
        <PhoneField
          value=""
          onChange={noop}
          field={{ type: 'phone' } as any}
        />
      );
      expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();
    });
  });
});
