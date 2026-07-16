/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineFieldInput } from '../InlineFieldInput';

/**
 * `<InlineFieldInput>` is the edit-input branch extracted verbatim from
 * `DetailSection` (objectui#2407, step 0) so the details body and the highlights
 * strip render an identical editor. These tests pin the parity contract the
 * extraction must preserve: type-aware widget routing, `$expand`-ed reference
 * safety, ISO date coercion, object-value guarding, and auto-focus.
 *
 * Assertions are provider-free (matching the existing DetailSection inline-edit
 * suites) so they hold whether or not i18n / permission providers are mounted.
 */
describe('InlineFieldInput', () => {
  it('renders an editable text input and emits typed values via onChange', () => {
    const onChange = vi.fn();
    render(
      <InlineFieldInput
        field={{ name: 'title', type: 'text' }}
        value="Hello"
        onChange={onChange}
      />,
    );
    const input = screen.getByDisplayValue('Hello');
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Hi there' } });
    expect(onChange).toHaveBeenCalledWith('Hi there');
  });

  it('never leaks "[object Object]" for an $expand-ed reference value', () => {
    render(
      <InlineFieldInput
        field={{ name: 'project', type: 'master_detail', reference_to: 'projects' }}
        value={{ _id: 'p1', name: 'Apollo' }}
        onChange={vi.fn()}
      />,
    );
    // The reference renders the lookup picker (not a raw text input), so the
    // stringified object must never surface anywhere.
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
    expect(screen.queryByDisplayValue(/\[object Object\]/)).toBeNull();
  });

  it('never leaks "[object Object]" for an object value on a plain field', () => {
    render(
      <InlineFieldInput
        field={{ name: 'meta', type: 'text' }}
        value={{ foo: 'bar' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByDisplayValue(/\[object Object\]/)).toBeNull();
  });

  it('slices an ISO timestamp to YYYY-MM-DD for the date input and re-emits ISO on change', () => {
    const onChange = vi.fn();
    render(
      <InlineFieldInput
        field={{ name: 'due', type: 'date' }}
        value="2026-02-14T14:46:20.862Z"
        onChange={onChange}
      />,
    );
    const input = screen.getByDisplayValue('2026-02-14');
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '2026-03-01' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    // Re-emitted as a full ISO timestamp (TZ-independent shape assertion).
    const arg = onChange.mock.calls[0][0];
    expect(typeof arg).toBe('string');
    expect(arg).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('auto-focuses the input when autoFocus is set', () => {
    render(
      <InlineFieldInput
        field={{ name: 'title', type: 'text' }}
        value="Hello"
        onChange={vi.fn()}
        autoFocus
      />,
    );
    expect(screen.getByDisplayValue('Hello')).toHaveFocus();
  });
});
