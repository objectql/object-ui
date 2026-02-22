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
});
