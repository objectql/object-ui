/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import {
  renderComponent,
  validateComponentRegistration,
  getAllDisplayIssues,
} from './test-utils';

// Import renderers to ensure registration
beforeAll(async () => {
  await import('../renderers');
}, 30000); // Increase timeout to 30 seconds for heavy renderer imports

/**
 * Comprehensive tests for form renderer components
 * These tests automatically detect display and accessibility issues
 */
describe('Form Renderers - Display Issue Detection', () => {
  describe('Button Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('button');
      expect(validation.isRegistered).toBe(true);
      expect(validation.hasConfig).toBe(true);
      expect(validation.hasDefaultProps).toBe(true);
    });

    it('should render button with label', () => {
      const { container } = renderComponent({
        type: 'button',
        label: 'Click Me',
      });

      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
      
      const issues = getAllDisplayIssues(container);
      const a11yIssues = issues.filter(i => i.includes('missing accessible label'));
      expect(a11yIssues).toHaveLength(0);
    });

    it('should support different variants', () => {
      const variants = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'];
      
      variants.forEach(variant => {
        const { container } = renderComponent({
          type: 'button',
          label: 'Test',
          variant,
        });

        const button = container.querySelector('button');
        expect(button).toBeTruthy();
      });
    });

    it('should support different sizes', () => {
      const sizes = ['default', 'sm', 'lg', 'icon'];
      
      sizes.forEach(size => {
        const { container } = renderComponent({
          type: 'button',
          label: 'Test',
          size,
        });

        const button = container.querySelector('button');
        expect(button).toBeTruthy();
      });
    });

    it('should render children when no label provided', () => {
      const { container } = renderComponent({
        type: 'button',
        body: [{ type: 'text', content: 'Child Content' }],
      });

      expect(container.textContent).toContain('Child Content');
    });
  });

  describe('Input Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('input');
      expect(validation.isRegistered).toBe(true);
      expect(validation.hasDefaultProps).toBe(true);
    });

    it('should render input with label', () => {
      const { container } = renderComponent({
        type: 'input',
        label: 'Username',
        name: 'username',
        id: 'username-input',
      });

      const input = container.querySelector('input');
      const label = container.querySelector('label');
      
      expect(input).toBeTruthy();
      expect(label).toBeTruthy();
      expect(label?.textContent).toContain('Username');
    });

    it('should show required indicator when required', () => {
      const { container } = renderComponent({
        type: 'input',
        label: 'Required Field',
        name: 'required',
        required: true,
      });

      const label = container.querySelector('label');
      // The label should have a required indicator (*)
      expect(label?.className).toContain('text-destructive');
    });

    it('should support different input types', () => {
      const types = ['text', 'email', 'password', 'number', 'tel', 'url', 'date'];
      
      types.forEach(inputType => {
        const { container } = renderComponent({
          type: 'input',
          label: 'Test',
          inputType,
        });

        const input = container.querySelector('input');
        expect(input?.getAttribute('type')).toBe(inputType);
      });
    });

    it('should display description when provided', () => {
      const { container } = renderComponent({
        type: 'input',
        label: 'Field',
        description: 'This is a helpful description',
      });

      expect(container.textContent).toContain('This is a helpful description');
    });

    it('should display error message when provided', () => {
      const { container } = renderComponent({
        type: 'input',
        label: 'Field',
        error: 'This field has an error',
      });

      expect(container.textContent).toContain('This field has an error');
      const error = container.querySelector('.text-destructive');
      expect(error).toBeTruthy();
    });

    it('should handle disabled state', () => {
      const { container } = renderComponent({
        type: 'input',
        label: 'Field',
        disabled: true,
      });

      const input = container.querySelector('input');
      expect(input?.hasAttribute('disabled')).toBe(true);
    });

    it('should handle readonly state', () => {
      const { container } = renderComponent({
        type: 'input',
        label: 'Field',
        readOnly: true,
      });

      const input = container.querySelector('input');
      expect(input?.hasAttribute('readonly')).toBe(true);
    });
  });

  describe('Email Input Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('email');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render email input with correct type', () => {
      const { container } = renderComponent({
        type: 'email',
        label: 'Email',
      });

      const input = container.querySelector('input[type="email"]');
      expect(input).toBeTruthy();
    });
  });

  describe('Password Input Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('password');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render password input with correct type', () => {
      const { container } = renderComponent({
        type: 'password',
        label: 'Password',
      });

      const input = container.querySelector('input[type="password"]');
      expect(input).toBeTruthy();
    });
  });

  describe('Textarea Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('textarea');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render textarea with label', () => {
      const { container } = renderComponent({
        type: 'textarea',
        label: 'Comments',
        name: 'comments',
      });

      const textarea = container.querySelector('textarea');
      const label = container.querySelector('label');
      
      expect(textarea).toBeTruthy();
      expect(label).toBeTruthy();
    });

    it('should support placeholder', () => {
      const { container } = renderComponent({
        type: 'textarea',
        label: 'Comments',
        placeholder: 'Enter your comments here',
      });

      const textarea = container.querySelector('textarea');
      expect(textarea?.getAttribute('placeholder')).toBe('Enter your comments here');
    });
  });

  describe('Select Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('select');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render select with options', () => {
      const { container } = renderComponent({
        type: 'select',
        label: 'Choose option',
        options: [
          { value: '1', label: 'Option 1' },
          { value: '2', label: 'Option 2' },
        ],
      });

      // Select component should be present
      expect(container.querySelector('[role="combobox"]') || container.querySelector('select')).toBeTruthy();
    });
  });

  describe('Checkbox Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('checkbox');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render checkbox with label', () => {
      const { container } = renderComponent({
        type: 'checkbox',
        label: 'Accept terms',
        name: 'terms',
      });

      const checkbox = container.querySelector('input[type="checkbox"], button[role="checkbox"]');
      expect(checkbox).toBeTruthy();
    });
  });

  describe('Switch Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('switch');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render switch component', () => {
      const { container } = renderComponent({
        type: 'switch',
        label: 'Enable feature',
      });

      const switchEl = container.querySelector('[role="switch"], button');
      expect(switchEl).toBeTruthy();
    });
  });

  describe('Radio Group Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('radio-group');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render radio group with options', () => {
      const { container } = renderComponent({
        type: 'radio-group',
        label: 'Choose one',
        options: [
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
        ],
      });

      const radioGroup = container.querySelector('[role="radiogroup"]');
      expect(radioGroup).toBeTruthy();
    });
  });

  describe('Slider Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('slider');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render slider component', () => {
      const { container } = renderComponent({
        type: 'slider',
        label: 'Volume',
        min: 0,
        max: 100,
      });

      const slider = container.querySelector('[role="slider"], input[type="range"]');
      expect(slider).toBeTruthy();
    });
  });

  describe('Label Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('label');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render label element', () => {
      const { container } = renderComponent({
        type: 'label',
        content: 'Form Label',
      });

      const label = container.querySelector('label');
      expect(label).toBeTruthy();
      expect(label?.textContent).toContain('Form Label');
    });
  });
});
