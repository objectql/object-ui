/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigFieldRenderer } from '../custom/config-field-renderer';
import type { ConfigField } from '../types/config-panel';

const defaultDraft = { name: 'Test', enabled: true, theme: 'dark', count: 5 };

describe('ConfigFieldRenderer', () => {
  describe('input type', () => {
    const field: ConfigField = { key: 'name', label: 'Name', type: 'input', placeholder: 'Enter name' };

    it('should render input with label', () => {
      render(<ConfigFieldRenderer field={field} value="Test" onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Name')).toBeDefined();
      expect(screen.getByTestId('config-field-name')).toBeDefined();
    });

    it('should display current value', () => {
      render(<ConfigFieldRenderer field={field} value="Hello" onChange={vi.fn()} draft={defaultDraft} />);
      expect((screen.getByTestId('config-field-name') as HTMLInputElement).value).toBe('Hello');
    });

    it('should call onChange on input', () => {
      const onChange = vi.fn();
      render(<ConfigFieldRenderer field={field} value="" onChange={onChange} draft={defaultDraft} />);
      fireEvent.change(screen.getByTestId('config-field-name'), { target: { value: 'New' } });
      expect(onChange).toHaveBeenCalledWith('New');
    });

    it('should use defaultValue when value is undefined', () => {
      const fieldWithDefault: ConfigField = { key: 'name', label: 'Name', type: 'input', defaultValue: 'Default' };
      render(<ConfigFieldRenderer field={fieldWithDefault} value={undefined} onChange={vi.fn()} draft={defaultDraft} />);
      expect((screen.getByTestId('config-field-name') as HTMLInputElement).value).toBe('Default');
    });
  });

  describe('switch type', () => {
    const field: ConfigField = { key: 'enabled', label: 'Enabled', type: 'switch' };

    it('should render switch with label', () => {
      render(<ConfigFieldRenderer field={field} value={true} onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Enabled')).toBeDefined();
      expect(screen.getByTestId('config-field-enabled')).toBeDefined();
    });

    it('should toggle on click', () => {
      const onChange = vi.fn();
      render(<ConfigFieldRenderer field={field} value={false} onChange={onChange} draft={defaultDraft} />);
      fireEvent.click(screen.getByTestId('config-field-enabled'));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('checkbox type', () => {
    const field: ConfigField = { key: 'checked', label: 'Active', type: 'checkbox' };

    it('should render checkbox with label', () => {
      render(<ConfigFieldRenderer field={field} value={false} onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Active')).toBeDefined();
      expect(screen.getByTestId('config-field-checked')).toBeDefined();
    });

    it('should toggle on click', () => {
      const onChange = vi.fn();
      render(<ConfigFieldRenderer field={field} value={false} onChange={onChange} draft={defaultDraft} />);
      fireEvent.click(screen.getByTestId('config-field-checked'));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('select type', () => {
    const field: ConfigField = {
      key: 'theme',
      label: 'Theme',
      type: 'select',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'auto', label: 'Auto' },
      ],
    };

    it('should render select trigger with label', () => {
      render(<ConfigFieldRenderer field={field} value="dark" onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Theme')).toBeDefined();
      expect(screen.getByTestId('config-field-theme')).toBeDefined();
    });
  });

  describe('slider type', () => {
    const field: ConfigField = {
      key: 'count',
      label: 'Count',
      type: 'slider',
      min: 1,
      max: 10,
      step: 1,
    };

    it('should render slider with label and value display', () => {
      render(<ConfigFieldRenderer field={field} value={5} onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Count')).toBeDefined();
      expect(screen.getByText('5')).toBeDefined();
    });
  });

  describe('color type', () => {
    const field: ConfigField = { key: 'bgColor', label: 'Background', type: 'color' };

    it('should render color picker', () => {
      render(<ConfigFieldRenderer field={field} value="#ff0000" onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Background')).toBeDefined();
      const input = screen.getByTestId('config-field-bgColor') as HTMLInputElement;
      expect(input.type).toBe('color');
      expect(input.value).toBe('#ff0000');
    });

    it('should call onChange on color change', () => {
      const onChange = vi.fn();
      render(<ConfigFieldRenderer field={field} value="#ff0000" onChange={onChange} draft={defaultDraft} />);
      fireEvent.change(screen.getByTestId('config-field-bgColor'), { target: { value: '#00ff00' } });
      expect(onChange).toHaveBeenCalledWith('#00ff00');
    });
  });

  describe('icon-group type', () => {
    const field: ConfigField = {
      key: 'size',
      label: 'Size',
      type: 'icon-group',
      options: [
        { value: 'sm', label: 'Small' },
        { value: 'md', label: 'Medium' },
        { value: 'lg', label: 'Large' },
      ],
    };

    it('should render icon group buttons', () => {
      render(<ConfigFieldRenderer field={field} value="md" onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Size')).toBeDefined();
      expect(screen.getByTitle('Small')).toBeDefined();
      expect(screen.getByTitle('Medium')).toBeDefined();
      expect(screen.getByTitle('Large')).toBeDefined();
    });

    it('should call onChange when button clicked', () => {
      const onChange = vi.fn();
      render(<ConfigFieldRenderer field={field} value="sm" onChange={onChange} draft={defaultDraft} />);
      fireEvent.click(screen.getByTitle('Large'));
      expect(onChange).toHaveBeenCalledWith('lg');
    });
  });

  describe('custom type', () => {
    it('should render custom content via render prop', () => {
      const field: ConfigField = {
        key: 'custom',
        label: 'Custom',
        type: 'custom',
        render: (value, onChange) => (
          <div data-testid="custom-render">
            <span>Custom: {value}</span>
            <button onClick={() => onChange('updated')}>Update</button>
          </div>
        ),
      };
      const onChange = vi.fn();
      render(<ConfigFieldRenderer field={field} value="initial" onChange={onChange} draft={defaultDraft} />);
      expect(screen.getByTestId('custom-render')).toBeDefined();
      expect(screen.getByText('Custom: initial')).toBeDefined();
      fireEvent.click(screen.getByText('Update'));
      expect(onChange).toHaveBeenCalledWith('updated');
    });

    it('should return null for custom type without render', () => {
      const field: ConfigField = { key: 'empty', label: 'Empty', type: 'custom' };
      const { container } = render(<ConfigFieldRenderer field={field} value={null} onChange={vi.fn()} draft={defaultDraft} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('visibility', () => {
    it('should hide field when visibleWhen returns false', () => {
      const field: ConfigField = {
        key: 'hidden',
        label: 'Hidden',
        type: 'input',
        visibleWhen: () => false,
      };
      const { container } = render(<ConfigFieldRenderer field={field} value="" onChange={vi.fn()} draft={defaultDraft} />);
      expect(container.innerHTML).toBe('');
    });

    it('should show field when visibleWhen returns true', () => {
      const field: ConfigField = {
        key: 'visible',
        label: 'Visible',
        type: 'input',
        visibleWhen: (draft) => draft.enabled === true,
      };
      render(<ConfigFieldRenderer field={field} value="" onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Visible')).toBeDefined();
    });

    it('should evaluate visibleWhen against draft', () => {
      const field: ConfigField = {
        key: 'conditional',
        label: 'Conditional',
        type: 'input',
        visibleWhen: (draft) => draft.theme === 'dark',
      };
      const { container: hidden } = render(
        <ConfigFieldRenderer field={field} value="" onChange={vi.fn()} draft={{ ...defaultDraft, theme: 'light' }} />,
      );
      expect(hidden.innerHTML).toBe('');

      render(<ConfigFieldRenderer field={field} value="" onChange={vi.fn()} draft={{ ...defaultDraft, theme: 'dark' }} />);
      expect(screen.getByText('Conditional')).toBeDefined();
    });
  });

  describe('field-picker type', () => {
    it('should render as clickable config row', () => {
      const field: ConfigField = { key: 'field', label: 'Select Field', type: 'field-picker', placeholder: 'Choose...' };
      render(<ConfigFieldRenderer field={field} value={undefined} onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Select Field')).toBeDefined();
      expect(screen.getByText('Choose...')).toBeDefined();
    });
  });

  describe('filter/sort types', () => {
    it('should render filter with FilterBuilder', () => {
      const field: ConfigField = {
        key: 'filter',
        label: 'Filters',
        type: 'filter',
        fields: [
          { value: 'name', label: 'Name' },
          { value: 'status', label: 'Status' },
        ],
      };
      render(<ConfigFieldRenderer field={field} value={undefined} onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Filters')).toBeDefined();
      expect(screen.getByTestId('config-field-filter')).toBeDefined();
      // FilterBuilder renders 'Where' label and 'Add filter' button
      expect(screen.getByText('Add filter')).toBeDefined();
    });

    it('should render sort with SortBuilder', () => {
      const field: ConfigField = {
        key: 'sort',
        label: 'Sorting',
        type: 'sort',
        fields: [
          { value: 'name', label: 'Name' },
          { value: 'date', label: 'Date' },
        ],
      };
      render(<ConfigFieldRenderer field={field} value={undefined} onChange={vi.fn()} draft={defaultDraft} />);
      expect(screen.getByText('Sorting')).toBeDefined();
      expect(screen.getByTestId('config-field-sort')).toBeDefined();
      // SortBuilder renders 'Add sort' button
      expect(screen.getByText('Add sort')).toBeDefined();
    });
  });
});
