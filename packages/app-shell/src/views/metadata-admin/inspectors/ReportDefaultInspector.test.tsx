// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReportDefaultInspector } from './ReportDefaultInspector';

afterEach(cleanup);

const baseProps = {
  type: 'report',
  name: 'pipeline',
  locale: 'en-US' as const,
  onSelectionChange: vi.fn(),
  // An override short-circuits useObjectFields' network fetch so the
  // inspector renders with zero context / transport dependency.
  objectFieldsOverride: [
    { name: 'stage', label: 'Stage', type: 'text', hidden: false },
    { name: 'amount', label: 'Amount', type: 'currency', hidden: false },
  ],
};

function labelledInput(label: string): HTMLInputElement {
  const lab = screen.getByText(label);
  const input = lab.parentElement!.querySelector('input, textarea');
  return input as HTMLInputElement;
}

describe('ReportDefaultInspector — basics', () => {
  it('renders the curated report home (label / type / object / columns)', () => {
    render(
      <ReportDefaultInspector
        {...baseProps}
        draft={{
          name: 'pipeline',
          label: 'Pipeline',
          objectName: 'crm_lead',
          type: 'summary',
          columns: [{ field: 'stage', label: 'Stage' }],
        }}
        onPatch={vi.fn()}
        readOnly={false}
      />,
    );
    expect(labelledInput('Label').value).toBe('Pipeline');
    expect(labelledInput('Object').value).toBe('crm_lead');
    // The single existing column row shows.
    expect(screen.getByText('Stage')).toBeInTheDocument();
  });

  it('commits label / object edits via onPatch', () => {
    const onPatch = vi.fn();
    render(
      <ReportDefaultInspector
        {...baseProps}
        draft={{ name: 'pipeline', label: 'Pipeline', objectName: 'crm_lead', type: 'tabular', columns: [] }}
        onPatch={onPatch}
        readOnly={false}
      />,
    );
    fireEvent.change(labelledInput('Label'), { target: { value: 'Pipeline 2' } });
    expect(onPatch).toHaveBeenCalledWith({ label: 'Pipeline 2' });
    fireEvent.change(labelledInput('Object'), { target: { value: 'crm_account' } });
    expect(onPatch).toHaveBeenCalledWith({ objectName: 'crm_account' });
  });

  it('renders Chinese labels under zh-CN', () => {
    render(
      <ReportDefaultInspector
        {...baseProps}
        locale={'zh-CN'}
        draft={{ name: 'pipeline', label: '管道', objectName: 'crm_lead', type: 'tabular', columns: [] }}
        onPatch={vi.fn()}
        readOnly={false}
      />,
    );
    expect(screen.getByText('报表类型')).toBeInTheDocument();
  });

  it('disables inputs when readOnly', () => {
    render(
      <ReportDefaultInspector
        {...baseProps}
        draft={{ name: 'pipeline', label: 'Pipeline', objectName: 'crm_lead', type: 'tabular', columns: [] }}
        onPatch={vi.fn()}
        readOnly
      />,
    );
    expect(labelledInput('Label')).toBeDisabled();
    expect(labelledInput('Object')).toBeDisabled();
  });
});
