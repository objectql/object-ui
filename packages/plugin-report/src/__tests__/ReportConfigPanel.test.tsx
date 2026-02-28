/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportConfigPanel } from '../ReportConfigPanel';

const defaultConfig = {
  title: 'Sales Report',
  description: 'Monthly sales data',
  objectName: 'opportunity',
  limit: '100',
  showExportButtons: true,
  showPrintButton: true,
  defaultExportFormat: 'pdf',
  showToolbar: true,
  refreshInterval: '0',
};

const mockAvailableFields = [
  { value: 'name', label: 'Name', type: 'text' },
  { value: 'amount', label: 'Amount', type: 'number' },
  { value: 'stage', label: 'Stage', type: 'text' },
];

describe('ReportConfigPanel', () => {
  it('should render nothing when closed', () => {
    const { container } = render(
      <ReportConfigPanel
        open={false}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render panel when open', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('config-panel')).toBeDefined();
  });

  it('should display report breadcrumb', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Report')).toBeDefined();
    expect(screen.getByText('Configuration')).toBeDefined();
  });

  it('should display basic section fields', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Basic')).toBeDefined();
    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.getByText('Description')).toBeDefined();
  });

  it('should display data section', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Data')).toBeDefined();
    expect(screen.getByText('Data source')).toBeDefined();
    expect(screen.getByText('Row limit')).toBeDefined();
  });

  it('should display filters section', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
        availableFields={mockAvailableFields}
      />,
    );
    expect(screen.getByText('Filters')).toBeDefined();
    expect(screen.getByText('Conditions')).toBeDefined();
  });

  it('should display group by section', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
        availableFields={mockAvailableFields}
      />,
    );
    expect(screen.getByText('Group By')).toBeDefined();
    expect(screen.getByText('Grouping')).toBeDefined();
  });

  it('should have export section collapsed by default', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Export')).toBeDefined();
    // Fields should be hidden since export is collapsed by default
    expect(screen.queryByText('Show export buttons')).toBeNull();
  });

  it('should expand export section on click', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    // Click to expand
    fireEvent.click(screen.getByTestId('section-header-export'));
    expect(screen.getByText('Show export buttons')).toBeDefined();
    expect(screen.getByText('Default export format')).toBeDefined();
  });

  it('should have schedule section collapsed by default', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Schedule')).toBeDefined();
    // Schedule content should be hidden since collapsed by default
    expect(screen.queryByText('Schedule Configuration')).toBeNull();
  });

  it('should expand schedule section on click', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('section-header-schedule'));
    expect(screen.getByText('Schedule Configuration')).toBeDefined();
  });

  it('should have appearance section collapsed by default', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Appearance')).toBeDefined();
    expect(screen.queryByText('Show toolbar')).toBeNull();
  });

  it('should expand appearance section on click', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('section-header-appearance'));
    expect(screen.getByText('Show toolbar')).toBeDefined();
    expect(screen.getByText('Refresh interval')).toBeDefined();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <ReportConfigPanel
        open={true}
        onClose={onClose}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('config-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show save/discard footer after editing a field', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    // Edit the title input
    const titleInput = screen.getByTestId('config-field-title');
    fireEvent.change(titleInput, { target: { value: 'Updated Report' } });
    expect(screen.getByTestId('config-panel-footer')).toBeDefined();
  });

  it('should call onSave with updated draft', () => {
    const onSave = vi.fn();
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={onSave}
      />,
    );
    // Modify a field
    fireEvent.change(screen.getByTestId('config-field-title'), {
      target: { value: 'Updated Report Title' },
    });
    // Save
    fireEvent.click(screen.getByTestId('config-panel-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const savedDraft = onSave.mock.calls[0][0];
    expect(savedDraft.title).toBe('Updated Report Title');
  });

  it('should revert changes on discard', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    const input = screen.getByTestId('config-field-title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Temporary' } });
    expect(input.value).toBe('Temporary');

    // Discard
    fireEvent.click(screen.getByTestId('config-panel-discard'));

    // Footer should disappear (no longer dirty)
    expect(screen.queryByTestId('config-panel-footer')).toBeNull();
  });

  it('should call onFieldChange for live updates', () => {
    const onFieldChange = vi.fn();
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
        onFieldChange={onFieldChange}
      />,
    );
    fireEvent.change(screen.getByTestId('config-field-title'), {
      target: { value: 'New Title' },
    });
    expect(onFieldChange).toHaveBeenCalledWith('title', 'New Title');
  });

  it('should display report type selector in basic section', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Report type')).toBeInTheDocument();
  });

  it('should display columns section with field picker', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
        availableFields={mockAvailableFields}
      />,
    );
    expect(screen.getByText('Columns')).toBeInTheDocument();
    // Field picker should show available fields
    expect(screen.getByTestId('field-picker')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Stage')).toBeInTheDocument();
  });

  it('should show empty state when no available fields for field picker', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
        availableFields={[]}
      />,
    );
    expect(screen.getByTestId('field-picker-empty')).toBeInTheDocument();
    expect(screen.getByText('No fields available')).toBeInTheDocument();
  });

  it('should toggle field selection in field picker', () => {
    const onFieldChange = vi.fn();
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
        onFieldChange={onFieldChange}
        availableFields={mockAvailableFields}
      />,
    );
    // Click on a field checkbox to select it
    fireEvent.click(screen.getByTestId('field-picker-name'));
    expect(onFieldChange).toHaveBeenCalledWith('fields', [
      { name: 'name', label: 'Name', type: 'text' },
    ]);
  });

  it('should show undo/redo buttons in header', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('config-panel-undo')).toBeInTheDocument();
    expect(screen.getByTestId('config-panel-redo')).toBeInTheDocument();
  });

  it('should enable undo after making a change', () => {
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={defaultConfig}
        onSave={vi.fn()}
      />,
    );
    const undoBtn = screen.getByTestId('config-panel-undo');
    expect(undoBtn).toHaveAttribute('disabled');

    // Make a change
    fireEvent.change(screen.getByTestId('config-field-title'), {
      target: { value: 'Changed Title' },
    });

    // Undo should now be enabled
    expect(undoBtn).not.toHaveAttribute('disabled');
  });

  it('should include reportType in saved draft', () => {
    const onSave = vi.fn();
    render(
      <ReportConfigPanel
        open={true}
        onClose={vi.fn()}
        config={{ ...defaultConfig, reportType: 'summary' }}
        onSave={onSave}
      />,
    );
    // Make a change to trigger dirty state
    fireEvent.change(screen.getByTestId('config-field-title'), {
      target: { value: 'Modified' },
    });
    fireEvent.click(screen.getByTestId('config-panel-save'));
    const saved = onSave.mock.calls[0][0];
    expect(saved.reportType).toBe('summary');
  });
});
