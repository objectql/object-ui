/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineEditProvider, useInlineEdit } from '@object-ui/react';
import { HeaderHighlight } from '../HeaderHighlight';

/**
 * objectui#2407 P2 — the highlights strip becomes editable against the SHARED
 * record-level draft: double-click / pencil enters the same edit session as the
 * body, computed/readonly highlights expose no editor, and edits land in the
 * one draft the save bar commits.
 */

// Surfaces the shared draft so we can prove highlight edits land in the SAME
// draft the body + save bar read.
function DraftProbe() {
  const inline = useInlineEdit();
  return <div data-testid="draft">{JSON.stringify(inline?.draft ?? null)}</div>;
}

const objectSchema = {
  fields: {
    owner: { type: 'text' },
    score: { type: 'formula' }, // computed → never editable
  },
};
const fields = [{ name: 'owner', label: 'Owner' }, { name: 'score', label: 'Score' }] as any;
const data = { owner: 'Alice', score: '99' };

describe('HeaderHighlight — editable highlights (P2)', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  });

  it('is read-only with no <InlineEditProvider> (bare usage)', () => {
    render(<HeaderHighlight fields={fields} data={data} objectSchema={objectSchema} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Alice')).toBeNull();
  });

  it('double-clicking an editable highlight enters the shared edit session', () => {
    render(
      <InlineEditProvider canEdit>
        <HeaderHighlight fields={fields} data={data} objectSchema={objectSchema} />
        <DraftProbe />
      </InlineEditProvider>,
    );
    // Read mode: value shown, no editor.
    expect(screen.queryByDisplayValue('Alice')).toBeNull();
    fireEvent.doubleClick(screen.getByText('Alice'));
    // Now editable in place.
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('never exposes an editor for a computed highlight, even while editing', () => {
    render(
      <InlineEditProvider canEdit>
        <HeaderHighlight fields={fields} data={data} objectSchema={objectSchema} />
      </InlineEditProvider>,
    );
    fireEvent.doubleClick(screen.getByText('Alice')); // enter edit
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument(); // owner editable
    expect(screen.queryByDisplayValue('99')).toBeNull(); // score (formula) stays read-only
  });

  it('routes a highlight edit into the SHARED draft', () => {
    render(
      <InlineEditProvider canEdit>
        <HeaderHighlight fields={fields} data={data} objectSchema={objectSchema} />
        <DraftProbe />
      </InlineEditProvider>,
    );
    fireEvent.doubleClick(screen.getByText('Alice'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Bob' } });
    expect(screen.getByTestId('draft').textContent).toBe('{"owner":"Bob"}');
  });

  it('offers no editor when the record is not editable (canEdit=false)', () => {
    render(
      <InlineEditProvider canEdit={false}>
        <HeaderHighlight fields={fields} data={data} objectSchema={objectSchema} />
      </InlineEditProvider>,
    );
    fireEvent.doubleClick(screen.getByText('Alice'));
    expect(screen.queryByDisplayValue('Alice')).toBeNull();
  });
});
