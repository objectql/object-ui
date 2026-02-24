/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetConfigPanel } from '../WidgetConfigPanel';

const defaultWidgetConfig = {
  title: 'Revenue Chart',
  description: 'Monthly revenue breakdown',
  type: 'bar',
  object: 'orders',
  categoryField: 'month',
  valueField: 'amount',
  aggregate: 'sum',
  colorVariant: 'blue',
  actionUrl: '',
  layoutW: 2,
  layoutH: 1,
};

describe('WidgetConfigPanel', () => {
  it('should render nothing when closed', () => {
    const { container } = render(
      <WidgetConfigPanel
        open={false}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render panel when open', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('config-panel')).toBeDefined();
  });

  it('should display widget breadcrumb', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Widget')).toBeDefined();
  });

  it('should display general section with title, description, and type fields', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('General')).toBeDefined();
    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.getByText('Description')).toBeDefined();
    expect(screen.getByText('Widget type')).toBeDefined();
  });

  it('should display data binding section', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Data Binding')).toBeDefined();
    expect(screen.getByText('Data source')).toBeDefined();
    expect(screen.getByText('Category field')).toBeDefined();
    expect(screen.getByText('Value field')).toBeDefined();
    expect(screen.getByText('Aggregation')).toBeDefined();
  });

  it('should display layout section', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Layout')).toBeDefined();
    expect(screen.getByText('Width (columns)')).toBeDefined();
    expect(screen.getByText('Height (rows)')).toBeDefined();
  });

  it('should have appearance section collapsed by default', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Appearance')).toBeDefined();
    // Fields inside collapsed section should not be visible
    expect(screen.queryByText('Color variant')).toBeNull();
    expect(screen.queryByText('Action URL')).toBeNull();
  });

  it('should expand appearance section on click', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('section-header-appearance'));
    expect(screen.getByText('Color variant')).toBeDefined();
    expect(screen.getByText('Action URL')).toBeDefined();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <WidgetConfigPanel
        open={true}
        onClose={onClose}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('config-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show save/discard footer after editing a field', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    const titleInput = screen.getByTestId('config-field-title');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });
    expect(screen.getByTestId('config-panel-footer')).toBeDefined();
  });

  it('should call onSave with updated draft', () => {
    const onSave = vi.fn();
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByTestId('config-field-title'), {
      target: { value: 'Updated Chart' },
    });
    fireEvent.click(screen.getByTestId('config-panel-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const savedDraft = onSave.mock.calls[0][0];
    expect(savedDraft.title).toBe('Updated Chart');
  });

  it('should revert changes on discard', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    const input = screen.getByTestId('config-field-title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Temp Title' } });
    expect(input.value).toBe('Temp Title');

    fireEvent.click(screen.getByTestId('config-panel-discard'));
    expect(screen.queryByTestId('config-panel-footer')).toBeNull();
  });

  it('should call onFieldChange for live updates', () => {
    const onFieldChange = vi.fn();
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
        onFieldChange={onFieldChange}
      />,
    );
    fireEvent.change(screen.getByTestId('config-field-title'), {
      target: { value: 'Live Update' },
    });
    expect(onFieldChange).toHaveBeenCalledWith('title', 'Live Update');
  });

  it('should populate fields with provided config values', () => {
    render(
      <WidgetConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultWidgetConfig}
        onSave={vi.fn()}
      />,
    );
    const titleInput = screen.getByTestId('config-field-title') as HTMLInputElement;
    expect(titleInput.value).toBe('Revenue Chart');
    const descInput = screen.getByTestId('config-field-description') as HTMLInputElement;
    expect(descInput.value).toBe('Monthly revenue breakdown');
  });

  // ---- Searchable combobox tests (availableObjects / availableFields) ------

  describe('with availableObjects', () => {
    const objects = [
      { value: 'accounts', label: 'Accounts' },
      { value: 'contacts', label: 'Contacts' },
      { value: 'orders', label: 'Orders' },
    ];

    it('should render data source as a combobox when availableObjects provided', () => {
      render(
        <WidgetConfigPanel
          open={true}
          onClose={vi.fn()}
          config={defaultWidgetConfig}
          onSave={vi.fn()}
          availableObjects={objects}
        />,
      );
      // The data source field should be a combobox (not a text input)
      const wrapper = screen.getByTestId('config-field-object');
      const comboboxBtn = wrapper.querySelector('[role="combobox"]');
      expect(comboboxBtn).toBeTruthy();
    });

    it('should render data source as an input when no availableObjects', () => {
      render(
        <WidgetConfigPanel
          open={true}
          onClose={vi.fn()}
          config={defaultWidgetConfig}
          onSave={vi.fn()}
        />,
      );
      const objectField = screen.getByTestId('config-field-object');
      expect(objectField.tagName).toBe('INPUT');
    });

    it('should render category/value fields as comboboxes when availableObjects provided', () => {
      const fields = [
        { value: 'name', label: 'Name' },
        { value: 'status', label: 'Status' },
      ];
      render(
        <WidgetConfigPanel
          open={true}
          onClose={vi.fn()}
          config={defaultWidgetConfig}
          onSave={vi.fn()}
          availableObjects={objects}
          availableFields={fields}
        />,
      );
      const catWrapper = screen.getByTestId('config-field-categoryField');
      expect(catWrapper.querySelector('[role="combobox"]')).toBeTruthy();
      const valWrapper = screen.getByTestId('config-field-valueField');
      expect(valWrapper.querySelector('[role="combobox"]')).toBeTruthy();
    });

    it('should disable field comboboxes when object is not selected', () => {
      const configWithNoObject = { ...defaultWidgetConfig, object: '' };
      render(
        <WidgetConfigPanel
          open={true}
          onClose={vi.fn()}
          config={configWithNoObject}
          onSave={vi.fn()}
          availableObjects={objects}
        />,
      );
      const catWrapper = screen.getByTestId('config-field-categoryField');
      const catBtn = catWrapper.querySelector('[role="combobox"]');
      expect(catBtn).toHaveAttribute('disabled');
      const valWrapper = screen.getByTestId('config-field-valueField');
      const valBtn = valWrapper.querySelector('[role="combobox"]');
      expect(valBtn).toHaveAttribute('disabled');
    });

    it('should not disable field comboboxes when object is selected', () => {
      const fields = [
        { value: 'name', label: 'Name' },
        { value: 'amount', label: 'Amount' },
      ];
      render(
        <WidgetConfigPanel
          open={true}
          onClose={vi.fn()}
          config={defaultWidgetConfig}
          onSave={vi.fn()}
          availableObjects={objects}
          availableFields={fields}
        />,
      );
      const catWrapper = screen.getByTestId('config-field-categoryField');
      const catBtn = catWrapper.querySelector('[role="combobox"]');
      expect(catBtn).not.toHaveAttribute('disabled');
      const valWrapper = screen.getByTestId('config-field-valueField');
      const valBtn = valWrapper.querySelector('[role="combobox"]');
      expect(valBtn).not.toHaveAttribute('disabled');
    });
  });
});
