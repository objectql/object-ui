/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#4250 — the DOM half of the `richtext` spelling fix. `SKIP_TYPES` is
 * matched against the raw `def.type`, and its member was `rich_text`: a
 * spelling `@objectstack/spec` rejects outright (it exists only as a typo key in
 * the spec's own suggestion table), so the set excluded nothing while a real
 * spec-spelled `richtext` field was auto-derived into a related-list column.
 *
 * These pins assert the RENDERED column set, not the set's string membership —
 * revert `richtext`/`markdown` out of `SKIP_TYPES` and the two "not derived"
 * cases go red on a header that reappears.
 *
 * WHAT THE CELL ACTUALLY DID (measured on the pre-fix tree, and why the pin is
 * phrased as "no document markup" rather than "no raw markup"): a `richtext`
 * value did NOT render as raw markup. `getCellRenderer('richtext')` resolves to
 * `MarkdownCellRenderer`, so the cell held FORMATTED, sanitized GFM. The harm is
 * that the formatted output is BLOCK-level — `<h1>` / `<p>` / `<ul>` — inside a
 * `truncate` single-line table cell, so a document rendered as one clipped
 * heading with the rest invisible. `html` (already skipped) formats the same
 * way through `HtmlCellRenderer`, which is why "has a formatting renderer" was
 * never the discriminator this set used.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
// The markdown cell renderer is behind `React.lazy`; import the chunk at module
// scope so the factory resolves immediately and the assertions are not racing
// the module loader (AGENTS.md §测试纪律). Same specifier the component uses.
import '@object-ui/fields/widgets/MarkdownContent';
import { RelatedList } from '../RelatedList';

/** Multi-block markdown — the shape whose formatted render is `<h1>` + `<ul>`. */
const DOC = '# Heading\n\n**bold** and `code`\n\n- one\n- two';

const fields = {
  subject: { type: 'text', label: 'Subject' },
  amount: { type: 'currency', label: 'Amount' },
  body_rt: { type: 'richtext', label: 'Body Rich' },
  body_md: { type: 'markdown', label: 'Body Markdown' },
  body_html: { type: 'html', label: 'Body Html' },
  payload: { type: 'json', label: 'Payload' },
  memo: { type: 'textarea', label: 'Memo' },
};

const row = {
  id: 'n1',
  subject: 'Note one',
  amount: 42,
  body_rt: DOC,
  body_md: DOC,
  body_html: '<b>htmlbold</b>',
  payload: { a: 1 },
  memo: 'a plain long-form memo',
};

const makeDS = (rows: any[]) => ({
  find: vi.fn(async () => rows),
  getObjectSchema: vi.fn(async () => ({ name: 'note_line', fields })),
});

function renderList(extra: Record<string, unknown> = {}) {
  return render(
    <RelatedList
      title="Notes"
      type="table"
      api="note_line"
      objectName="note_line"
      referenceField="note"
      parentId="N-1"
      maxColumns={10}
      dataSource={makeDS([row]) as any}
      {...(extra as any)}
    />,
  );
}

describe('RelatedList — long-form types stay out of auto-derived columns (#4250)', () => {
  it('does not derive a column for a spec-spelled `richtext` field', async () => {
    const { container } = renderList();
    // Control: the walk ran and produced real columns.
    await waitFor(() => expect(screen.getByText('Subject')).toBeTruthy());
    expect(screen.getByText('Amount')).toBeTruthy();

    expect(screen.queryByText('Body Rich')).toBeNull();
    // …and nothing rendered the document into a cell.
    expect(container.querySelector('td h1')).toBeNull();
    expect(screen.queryByText('Heading')).toBeNull();
  });

  it('does not derive a column for a `markdown` field either', async () => {
    renderList();
    await waitFor(() => expect(screen.getByText('Subject')).toBeTruthy());
    expect(screen.queryByText('Body Markdown')).toBeNull();
  });

  it('keeps the pre-existing `html` / `json` exclusions', async () => {
    renderList();
    await waitFor(() => expect(screen.getByText('Subject')).toBeTruthy());
    expect(screen.queryByText('Body Html')).toBeNull();
    expect(screen.queryByText('Payload')).toBeNull();
  });

  it('still derives `textarea` — plain truncated text is a useful cell', async () => {
    renderList();
    // The measurement read the other way: `textarea` has no block-level render,
    // so excluding it would hide a business column for nothing (objectui#2360).
    await waitFor(() => expect(screen.getByText('Memo')).toBeTruthy());
    expect(screen.getByText('a plain long-form memo')).toBeTruthy();
  });

  it('an AUTHOR-DECLARED richtext column is still rendered', async () => {
    // The set filters the zero-config auto-derive walk only. An explicit column
    // is the author saying they want it — over-skipping that is the objectui#2360
    // harm, and this is the control that says the fix did not reintroduce it.
    renderList({ columns: ['subject', 'body_rt'] });
    await waitFor(() => expect(screen.getByText('Body Rich')).toBeTruthy());
    expect(await screen.findByText('Heading')).toBeTruthy();
  });
});
