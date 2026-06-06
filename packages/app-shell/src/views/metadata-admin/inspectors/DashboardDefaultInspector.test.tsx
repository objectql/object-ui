// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DashboardDefaultInspector } from './DashboardDefaultInspector';

afterEach(cleanup);

const baseProps = {
  type: 'dashboard',
  name: 'sales',
  locale: 'en-US' as const,
  onSelectionChange: vi.fn(),
};

function labelledInput(label: string): HTMLInputElement {
  const lab = screen.getByText(label);
  const input = lab.parentElement!.querySelector('input, textarea');
  return input as HTMLInputElement;
}

const draftWithWidget = {
  name: 'sales',
  label: 'Sales Overview',
  description: 'KPIs',
  widgets: [{ id: 'widget_1', type: 'metric', title: 'Revenue' }],
};

describe('DashboardDefaultInspector — basics', () => {
  it('renders the curated dashboard home (label / description / widgets)', () => {
    render(
      <DashboardDefaultInspector
        {...baseProps}
        draft={draftWithWidget}
        onPatch={vi.fn()}
        readOnly={false}
      />,
    );
    expect(labelledInput('Label').value).toBe('Sales Overview');
    expect(labelledInput('Description').value).toBe('KPIs');
    // The single existing widget row shows.
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('commits label / description edits via onPatch', () => {
    const onPatch = vi.fn();
    render(
      <DashboardDefaultInspector
        {...baseProps}
        draft={draftWithWidget}
        onPatch={onPatch}
        readOnly={false}
      />,
    );
    fireEvent.change(labelledInput('Label'), { target: { value: 'Sales 2' } });
    expect(onPatch).toHaveBeenCalledWith({ label: 'Sales 2' });
    fireEvent.change(labelledInput('Description'), { target: { value: 'More' } });
    expect(onPatch).toHaveBeenCalledWith({ description: 'More' });
  });

  it('drills into a widget by its id on selection', () => {
    const onSelectionChange = vi.fn();
    render(
      <DashboardDefaultInspector
        {...baseProps}
        onSelectionChange={onSelectionChange}
        draft={draftWithWidget}
        onPatch={vi.fn()}
        readOnly={false}
      />,
    );
    fireEvent.click(screen.getByText('Revenue'));
    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: 'widget',
      id: 'widget_1',
      label: 'Revenue',
    });
  });

  it('renders Chinese labels under zh-CN', () => {
    render(
      <DashboardDefaultInspector
        {...baseProps}
        locale={'zh-CN'}
        draft={draftWithWidget}
        onPatch={vi.fn()}
        readOnly={false}
      />,
    );
    expect(screen.getByText('仪表盘')).toBeInTheDocument();
  });

  it('disables inputs when readOnly', () => {
    render(
      <DashboardDefaultInspector
        {...baseProps}
        draft={draftWithWidget}
        onPatch={vi.fn()}
        readOnly
      />,
    );
    expect(labelledInput('Label')).toBeDisabled();
    expect(labelledInput('Description')).toBeDisabled();
  });
});
