/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordDetailDrawer } from '../RecordDetailDrawer';

/**
 * Capability = handler presence (#2436 第 5 项).
 *
 * The drawer must derive its edit/delete affordances from whether the host
 * actually supplied `onFieldSave` / `onDelete` — a caller that omits them
 * (e.g. plugin-gantt for a row locked via `lockField`, or a globally
 * read-only gantt) gets a strictly read-only drawer. Previously the drawer
 * hardcoded `inlineEdit` + `showDelete: true` and always passed wrapper
 * functions down, so the inner DetailView saw live handlers even when the
 * outer props were undefined — letting users "edit" locked records (the
 * edits silently went nowhere) and see a Delete action that shouldn't exist.
 *
 * DetailView is mocked to capture the exact props it receives; its own
 * gating of `inlineEdit` / `schema.showDelete` is covered by the DetailView
 * and DetailSection test suites.
 */

const captured = vi.hoisted(() => ({ props: [] as any[] }));

vi.mock('../DetailView', () => ({
  DetailView: (props: any) => {
    captured.props.push(props);
    return <div data-testid="dv-probe" />;
  },
}));

function lastProps() {
  expect(captured.props.length).toBeGreaterThan(0);
  return captured.props[captured.props.length - 1];
}

function renderDrawer(extra: Partial<React.ComponentProps<typeof RecordDetailDrawer>> = {}) {
  return render(
    <RecordDetailDrawer
      open
      onClose={() => {}}
      title="Task Details"
      record={{ id: '1', name: 'Hello' }}
      objectName="tasks"
      recordId="1"
      {...extra}
    />,
  );
}

beforeEach(() => {
  captured.props.length = 0;
});

describe('RecordDetailDrawer capability = handler presence', () => {
  it('enables inline edit and delete when both handlers are supplied', () => {
    renderDrawer({ onFieldSave: vi.fn(), onDelete: vi.fn() });
    const props = lastProps();
    expect(props.inlineEdit).toBe(true);
    expect(props.schema.showDelete).toBe(true);
    expect(typeof props.onFieldSave).toBe('function');
    expect(typeof props.onDelete).toBe('function');
  });

  it('renders strictly read-only when both handlers are omitted', () => {
    renderDrawer();
    const props = lastProps();
    expect(props.inlineEdit).toBe(false);
    expect(props.schema.showDelete).toBe(false);
    expect(props.onFieldSave).toBeUndefined();
    expect(props.onDelete).toBeUndefined();
  });

  it('gates each capability independently (save without delete)', () => {
    renderDrawer({ onFieldSave: vi.fn() });
    const props = lastProps();
    expect(props.inlineEdit).toBe(true);
    expect(props.schema.showDelete).toBe(false);
    expect(props.onDelete).toBeUndefined();
  });

  it('forwards field saves to the host handler', async () => {
    const onFieldSave = vi.fn().mockResolvedValue(undefined);
    renderDrawer({ onFieldSave });
    await lastProps().onFieldSave('name', 'World');
    expect(onFieldSave).toHaveBeenCalledWith('name', 'World');
  });

  it('closes the drawer after a successful delete, but not on failure', async () => {
    const onClose = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderDrawer({ onClose, onDelete });
    await lastProps().onDelete();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Failure path: the wrapper swallows (logs) the error and keeps the
    // drawer open so the user can retry.
    captured.props.length = 0;
    const onClose2 = vi.fn();
    const failingDelete = vi.fn().mockRejectedValue(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderDrawer({ onClose: onClose2, onDelete: failingDelete });
    await lastProps().onDelete();
    await waitFor(() => expect(failingDelete).toHaveBeenCalledTimes(1));
    expect(onClose2).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
