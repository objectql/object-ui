/**
 * Regression for objectstack-ai/objectui#3466: single-line cell renderers
 * emitted a BARE INLINE `span.truncate`. An inline box has no width box, so
 * `overflow:hidden` / `text-overflow:ellipsis` never engage — the value
 * rendered at full content width and its tail was silently clipped by
 * whatever ancestor happened to clip (the record-detail card edge), with no
 * ellipsis and no way to read the full text (the detail row's `title` is the
 * inline-edit hint, not the value). Same mechanism as the JSON cell fix in
 * objectui#2578.
 *
 * Pin: every single-line value renderer emits a BLOCK-level, `max-w-full`
 * truncating span that carries the full text in `title` (so hovering the
 * value shows the full text, taking precedence over any ancestor `title`).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import {
  TextCellRenderer,
  LookupCellRenderer,
  UserCellRenderer,
  FileCellRenderer,
  SelectCellRenderer,
} from '../index';
import { SchemaRendererProvider } from '@object-ui/react';

const LONG =
  'A remarkably long referenced-record title that a detail card column can never fit on a single line without an ellipsis';

/** The block-level truncation contract every single-line value span must meet. */
function expectTruncating(el: HTMLElement, fullText: string) {
  expect(el).toHaveClass('block', 'max-w-full', 'truncate');
  expect(el).toHaveAttribute('title', fullText);
}

describe('cell renderers truncate for real and expose the full text (issue #3466)', () => {
  it('TextCellRenderer: block-level truncating span with title fallback', () => {
    render(<TextCellRenderer value={LONG} field={{ type: 'text' } as any} />);
    expectTruncating(screen.getByText(LONG), LONG);
  });

  it('LookupCellRenderer: expanded record object', () => {
    const ds = { find: vi.fn(), findOne: vi.fn() } as any;
    render(
      <SchemaRendererProvider dataSource={ds}>
        <LookupCellRenderer
          value={{ id: 'rec1', name: LONG }}
          field={{ type: 'lookup', reference_to: 'obj_a' } as any}
        />
      </SchemaRendererProvider>,
    );
    expectTruncating(screen.getByText(LONG), LONG);
  });

  it('LookupCellRenderer: primitive non-opaque value', () => {
    const ds = { find: vi.fn(), findOne: vi.fn() } as any;
    render(
      <SchemaRendererProvider dataSource={ds}>
        <LookupCellRenderer value={LONG} field={{ type: 'lookup' } as any} />
      </SchemaRendererProvider>,
    );
    expectTruncating(screen.getByText(LONG), LONG);
  });

  it('UserCellRenderer: display name beside the avatar', () => {
    render(<UserCellRenderer value={{ name: LONG }} field={{ type: 'user' } as any} />);
    expectTruncating(screen.getByText(LONG), LONG);
  });

  it('FileCellRenderer: single file name', () => {
    render(<FileCellRenderer value={{ name: LONG }} field={{ type: 'file' } as any} />);
    expectTruncating(screen.getByText(LONG), LONG);
  });

  it('SelectCellRenderer (dot): bounded container with title, shrinkable label', () => {
    render(
      <SelectCellRenderer
        value="opt1"
        field={{
          type: 'select',
          appearance: 'dot',
          options: [{ value: 'opt1', label: LONG }],
        } as any}
      />,
    );
    const label = screen.getByText(LONG);
    // The label shrinks inside the dot row; the row itself is width-bounded
    // and carries the full text on hover.
    expect(label).toHaveClass('min-w-0', 'truncate');
    const row = label.parentElement!;
    expect(row).toHaveClass('max-w-full');
    expect(row).toHaveAttribute('title', LONG);
  });
});
