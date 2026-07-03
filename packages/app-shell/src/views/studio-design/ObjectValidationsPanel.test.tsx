/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ObjectValidationsPanel } from './ObjectValidationsPanel';

const draft = {
  fields: {
    name: { type: 'text', label: '名称' },
    amount: { type: 'number', label: '金额' },
  },
  validations: [
    { type: 'script', name: 'no_negative', message: '金额不能为负', condition: 'record.amount < 0', severity: 'error' },
    { type: 'state_machine', name: 'status_flow', message: '非法状态转移', field: 'status', transitions: {} },
  ],
};

describe('ObjectValidationsPanel', () => {
  it('lists every rule with its type badge (non-script rules stay visible)', () => {
    render(<ObjectValidationsPanel draft={draft} onPatch={() => {}} />);
    expect(screen.getByText('no_negative')).toBeTruthy();
    expect(screen.getByText('status_flow')).toBeTruthy();
    expect(screen.getByText('state_machine')).toBeTruthy();
  });

  it('adds a script rule with a VALID never-failing default condition', () => {
    const onPatch = vi.fn();
    render(<ObjectValidationsPanel draft={draft} onPatch={onPatch} />);
    fireEvent.click(screen.getByText('新增'));
    const patch = onPatch.mock.calls[0][0];
    const added = patch.validations[patch.validations.length - 1];
    // An empty condition 422s the whole draft save (spec ExpressionInputSchema)
    // and dead-ends the create flow — the default must be a valid CEL no-op.
    expect(added).toMatchObject({ type: 'script', name: 'validation_3', condition: 'false', severity: 'error' });
    expect(patch.validations).toHaveLength(3);
  });

  it('edits a script rule message via onPatch without touching other rules', () => {
    const onPatch = vi.fn();
    render(<ObjectValidationsPanel draft={draft} onPatch={onPatch} />);
    fireEvent.click(screen.getByText('no_negative'));
    const msg = screen.getByDisplayValue('金额不能为负');
    fireEvent.change(msg, { target: { value: '金额必须 ≥ 0' } });
    const patch = onPatch.mock.calls[0][0];
    expect(patch.validations[0].message).toBe('金额必须 ≥ 0');
    expect(patch.validations[1]).toEqual(draft.validations[1]);
  });

  it('marks non-script rules read-only (structured configs stay code-authored)', () => {
    render(<ObjectValidationsPanel draft={draft} onPatch={() => {}} />);
    fireEvent.click(screen.getByText('status_flow'));
    expect(screen.getByText(/暂不支持在此编辑/)).toBeTruthy();
  });

  it('deletes a rule', () => {
    const onPatch = vi.fn();
    render(<ObjectValidationsPanel draft={draft} onPatch={onPatch} />);
    fireEvent.click(screen.getByText('no_negative'));
    fireEvent.click(screen.getAllByText('删除')[0]);
    const patch = onPatch.mock.calls[0][0];
    expect(patch.validations).toHaveLength(1);
    expect(patch.validations[0].name).toBe('status_flow');
  });
});
