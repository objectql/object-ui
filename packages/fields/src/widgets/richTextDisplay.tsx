/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The DISPLAY half of the three rich-content field types — `markdown`, `html`
 * and `richtext` — and the single table that says which pipeline each one
 * reads through.
 *
 * ## Why this is its own module (objectui#5498)
 *
 * These two renderers used to live in `../index.tsx`, which meant the only way
 * to reach them was through the barrel — and the barrel is what registers
 * `RichTextField`, so the widget could not import them back without a cycle.
 * The readonly branch of `RichTextField` therefore rendered `{value}` as a
 * React TEXT CHILD and showed a user the markup SOURCE of their own field: a
 * `markdown` field's asterisks and hashes, a `richtext` field's tags. Every
 * OTHER read surface — grid, kanban card, gallery, related list, dashboard
 * record panel, record detail read mode — dispatches through `getCellRenderer`
 * and rendered the same stored bytes FORMATTED, so one field disagreed with
 * itself depending on which surface the user was looking at.
 *
 * Extracting them here is what lets both sides consume the SAME components:
 * `getCellRenderer`'s table spreads {@link RICH_TEXT_CELL_RENDERERS}, and the
 * widget's readonly branch indexes it. There is one dispatch table for these
 * three types, not two that can drift — which matters because drift is exactly
 * how objectui#5452 happened (`richtext` pointing at the markdown pipeline).
 */

import React from 'react';
import { EmptyValue } from '@object-ui/components';
import type { CellRendererProps } from '../index.js';

const LazyMarkdownContent = React.lazy(() => import('./MarkdownContent.js'));

/**
 * Renders `markdown` values as formatted GFM markdown (lazy-loaded, sanitized)
 * instead of the raw markup string.
 *
 * Markdown ONLY. `MarkdownContent` runs react-markdown with no `rehype-raw`, so
 * raw HTML in the string is not parsed and never reaches the DOM — that is this
 * renderer's trust boundary, not an oversight, and it must stay that way
 * (objectui#5452). `richtext` used to be routed here too and rendered as a
 * COMPLETELY EMPTY cell, because a richtext value is entirely HTML and this
 * pipeline drops all of it; see {@link HtmlCellRenderer}, which is where that
 * type belongs. Loosening this pipeline to pass raw HTML through would have
 * "fixed" one type by moving every `markdown` cell's trust boundary.
 */
export function MarkdownCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (value == null || value === '') return <EmptyValue />;
  return (
    <React.Suspense fallback={<span className="text-sm text-muted-foreground">{String(value).slice(0, 80)}</span>}>
      <LazyMarkdownContent value={String(value)} />
    </React.Suspense>
  );
}

/**
 * Minimal HTML sanitizer for display: drops <script>/<style>/<iframe> blocks,
 * inline event handlers, and javascript: URLs. Defense-in-depth — stored HTML
 * is authored by users with write access, but is never trusted blindly.
 *
 * Deliberately NOT exported from the package barrel. It is the trust boundary
 * of {@link HtmlCellRenderer} and of nothing else: a second caller sanitizing
 * on its own and then rendering through its own `dangerouslySetInnerHTML` is
 * how one surface ends up a version behind this function. Consume the RENDERER.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '$1="#"');
}

/**
 * Renders an `html` value as sanitized, formatted HTML instead of raw markup.
 *
 * Also the renderer for `richtext` (objectui#5452). Both types store an HTML
 * string: the spec's `Field.richtext` is documented as "Formatted content with
 * HTML/WYSIWYG", the showcase seed's own specimen is
 * `<p>Rich <strong>text</strong></p>`, and this repo's designer bridge already
 * maps `richtext` onto its `html` type. {@link sanitizeHtml} above removes
 * script/style/iframe/object/embed blocks, inline event handlers and
 * `javascript:` URLs, and touches nothing a rich-text editor legitimately
 * emits — headings, paragraphs, emphasis, lists, links, quotes all survive, so
 * routing `richtext` here restores the content rather than trading a blank cell
 * for a mangled one.
 */
export function HtmlCellRenderer({ value }: CellRendererProps): React.ReactElement {
  if (value == null || value === '') return <EmptyValue />;
  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert break-words"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(value)) }}
    />
  );
}

/**
 * Field type → display pipeline, for the three types `RichTextField` serves.
 *
 * THE table, singular. `getCellRenderer`'s standard map spreads it (so the
 * grid, kanban, gallery, related list, dashboard panel and detail read mode
 * resolve through these entries) and `RichTextField`'s readonly branch indexes
 * it (so a readonly form field renders through the very same component). A
 * change here moves every read surface at once; there is no second copy left
 * to forget.
 *
 * `richtext` reads through the HTML renderer — NOT the markdown one, which
 * drops raw HTML and therefore rendered every populated richtext value as a
 * blank cell (objectui#5452).
 */
export const RICH_TEXT_CELL_RENDERERS = {
  markdown: MarkdownCellRenderer,
  html: HtmlCellRenderer,
  richtext: HtmlCellRenderer,
} as const satisfies Record<string, React.FC<CellRendererProps>>;

/** The rich-content field types, i.e. the keys of {@link RICH_TEXT_CELL_RENDERERS}. */
export type RichTextFieldType = keyof typeof RICH_TEXT_CELL_RENDERERS;

/**
 * The SYNTAX a rich-content type stores, derived from the renderer that type
 * resolves to rather than declared a second time.
 *
 * This is what `RichTextField`'s editor header names ("Format: markdown"), and
 * deriving it from {@link RICH_TEXT_CELL_RENDERERS} is the point: the header
 * used to be computed as `field.format || 'markdown'`, and since `format` is
 * declared on no rich-content field type (only on `date`/`datetime`/`time`/
 * `phone`/`auto_number`), it read `undefined` for every real field and labelled
 * an `html` field "Format: markdown" — a label pointing at a pipeline the value
 * does not go through. Derived, the label cannot disagree with the renderer.
 *
 * `undefined` for a type with no pipeline, rather than a guessed default: the
 * caller has to say what it does with "not a rich-content type" instead of
 * silently getting the markdown answer, which is the bug this replaces.
 */
export function richTextSyntax(fieldType: string): 'markdown' | 'html' | undefined {
  const renderer = richTextCellRenderer(fieldType);
  if (!renderer) return undefined;
  return renderer === MarkdownCellRenderer ? 'markdown' : 'html';
}

/**
 * The display pipeline a field type reads through, or `undefined` when the
 * type is not one of the three rich-content types.
 *
 * The lookup is a function rather than a raw index so the "not a rich-content
 * type" answer is in the RETURN TYPE. Indexing {@link RICH_TEXT_CELL_RENDERERS}
 * directly hands back a non-optional component for any key the caller casts,
 * so the miss becomes a runtime `undefined` the compiler has been told cannot
 * happen — and a caller that checks for it reads as dead code.
 */
export function richTextCellRenderer(
  fieldType: string,
): React.FC<CellRendererProps> | undefined {
  return (RICH_TEXT_CELL_RENDERERS as Record<string, React.FC<CellRendererProps>>)[fieldType];
}
