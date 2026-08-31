/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `rows` sizes the INLINE editor of both long-text widgets (objectui#6140).
 *
 * The read (`richField?.rows || 8` / `textareaField?.rows || 4`) predates this
 * card; what the card changed is the CONTRACT — `rows` became a declared
 * member of `MarkdownFieldMetadata` and `HtmlFieldMetadata` (maintainer
 * 2026-08-25, Option A, aligning the `TextareaFieldMetadata` precedent), so
 * the field literals below carry it under the excess-property check rather
 * than through a cast. The `richtext` registry key resolves to the same
 * widget (objectui#5498) with no union member of its own, so its case is the
 * one deliberate `as` in this file.
 *
 * Direction of the DOM assertion: `rows` lands on the HTML `rows` attribute of
 * the inline `<Textarea>`; the fullscreen dialog deliberately ignores it
 * (`rows={fullHeight ? undefined : rows}`), pinned by the fullscreen tests.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { HtmlFieldMetadata, MarkdownFieldMetadata, TextareaFieldMetadata } from '@object-ui/types';

import { RichTextField } from '../RichTextField';
import { TextAreaField } from '../TextAreaField';

describe('RichTextField — declared `rows` sizes the inline editor (#6140)', () => {
  it('markdown: an authored rows lands on the textarea', () => {
    const field: MarkdownFieldMetadata = { type: 'markdown', name: 'notes', rows: 12 };
    render(<RichTextField value="# hi" onChange={() => {}} field={field} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '12');
  });

  it('html: an authored rows lands on the textarea', () => {
    const field: HtmlFieldMetadata = { type: 'html', name: 'body', rows: 6 };
    render(<RichTextField value="<p>hi</p>" onChange={() => {}} field={field} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '6');
  });

  it('richtext: the third registry key of the same widget honours rows too', () => {
    // No `RichtextFieldMetadata` exists in the union — the runtime shape is
    // structural. Cast, deliberately, at the one seam that has no declared type.
    const field = { type: 'richtext', name: 'doc', rows: 10 } as unknown as MarkdownFieldMetadata;
    render(<RichTextField value="<p>hi</p>" onChange={() => {}} field={field} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '10');
  });

  it('defaults to 8 rows when the key is omitted', () => {
    const field: MarkdownFieldMetadata = { type: 'markdown', name: 'notes' };
    render(<RichTextField value="" onChange={() => {}} field={field} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '8');
  });
});

describe('TextAreaField — the precedent widget, same key, same channel', () => {
  it('an authored rows lands on the textarea', () => {
    const field: TextareaFieldMetadata = { type: 'textarea', name: 'summary', rows: 9 };
    render(<TextAreaField value="" onChange={() => {}} field={field} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '9');
  });

  it('defaults to 4 rows when the key is omitted', () => {
    const field: TextareaFieldMetadata = { type: 'textarea', name: 'summary' };
    render(<TextAreaField value="" onChange={() => {}} field={field} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4');
  });
});
