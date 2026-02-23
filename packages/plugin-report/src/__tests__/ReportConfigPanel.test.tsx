/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
