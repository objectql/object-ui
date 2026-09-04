/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#7658 — `extractToc`'s ids must be the ids `rehype-slug` actually
 * puts on the RENDERED headings, because that is the only thing a `#id` link
 * can resolve to.
 *
 * The truth source here is the real render pipeline (`MarkdownImpl` — the same
 * remark/rehype chain this plugin ships), NOT a second derivation of the slug
 * rules. Re-deriving them would only prove the two derivations agree; reading
 * the rendered `id` attribute proves the anchor exists.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import MarkdownImpl from './MarkdownImpl';
import { extractToc } from './toc';

/** The ids `rehype-slug` put on the rendered headings, in document order. */
function renderedHeadingIds(markdown: string): string[] {
  const html = renderToStaticMarkup(React.createElement(MarkdownImpl, { content: markdown }));
  return [...html.matchAll(/<h[1-6]\b[^>]*\bid="([^"]*)"/g)].map((m) => m[1]);
}

/** Every heading `extractToc` sees, in document order — h1–h6, not just the default h2–h3. */
function tocIds(markdown: string): string[] {
  return extractToc(markdown, { minDepth: 1, maxDepth: 6 }).map((item) => item.id);
}

/**
 * The three heading shapes this repository's own docs carry that hit the
 * defect: tag-shaped text inside a code span. In the DOM it is literal text
 * (a code span's content is a text value), so it is part of the anchor.
 */
const LIVE_SHAPES: ReadonlyArray<{ md: string; id: string; where: string }> = [
  {
    md: '### `objectui generate <type> <name>` (alias `g`)',
    id: 'objectui-generate-type-name-alias-g',
    where: 'content/docs/utilities/cli.mdx:136, packages/cli/README.md:108',
  },
  {
    md: '### `objectui add <component>`',
    id: 'objectui-add-component',
    where: 'content/docs/utilities/cli.mdx:220, packages/cli/README.md:112',
  },
  {
    md: '#### Serving metadata over HTTP (`?api=<base>`)',
    id: 'serving-metadata-over-http-apibase',
    where: 'content/docs/utilities/runner.mdx:106',
  },
];

describe('extractToc ↔ rendered-anchor parity (objectui#7658)', () => {
  for (const { md, id, where } of LIVE_SHAPES) {
    it(`resolves the anchor for ${md} (${where})`, () => {
      const source = `${md}\n`;
      // Reading the truth source is itself the lit control: an empty list here
      // means the harness rendered nothing, and every comparison below it would
      // be a vacuous pass.
      expect(renderedHeadingIds(source)).toEqual([id]);
      expect(tocIds(source)).toEqual([id]);
    });
  }

  it('control: agrees on the inline shapes that never had the defect', () => {
    // Lit control — these ids are non-empty and already matched before the fix,
    // so a run in which they read `[]` (or drifted) is a broken instrument
    // rather than evidence about the defect.
    const source = '# Title\n\n## First Section\n\n## The **overlay** `rule` and a [link](/x)\n';
    const rendered = renderedHeadingIds(source);
    expect(rendered).toEqual(['title', 'first-section', 'the-overlay-rule-and-a-link']);
    expect(tocIds(source)).toEqual(rendered);
  });

  it('still drops genuine raw HTML, exactly as the renderer does', () => {
    // The raw-HTML rule is not being removed, only kept off code spans:
    // `remark-rehype` drops raw html nodes (no `allowDangerousHtml`), so the
    // rendered heading keeps the wrapped text and not the tags.
    const source = '## A <b>bold</b> tag\n';
    expect(tocIds(source)).toEqual(renderedHeadingIds(source));
  });

  it('keeps duplicate-suffix alignment across affected headings', () => {
    // The `-1/-2` suffixes only line up if EVERY heading slugs the same text
    // the renderer slugs — one wrong id upstream shifts every later anchor.
    const source =
      '# `objectui add <component>`\n\n' +
      '## `objectui add <component>`\n\n' +
      '## `objectui add <component>`\n';
    const rendered = renderedHeadingIds(source);
    expect(rendered).toEqual(['objectui-add-component', 'objectui-add-component-1', 'objectui-add-component-2']);
    expect(tocIds(source)).toEqual(rendered);
  });

  it('keeps a code span literal against every other inline rule', () => {
    // Markdown inside a code span is not markdown — the renderer emits the
    // bytes verbatim, so no inline rule may reach inside one.
    const source = '## `a_b_c` and `**not bold**` and `[x](y)`\n';
    expect(tocIds(source)).toEqual(renderedHeadingIds(source));
  });

  it('still collapses a link whose label is a code span', () => {
    // The masking must stay VISIBLE to the link rule as ordinary text,
    // otherwise `[`code`](url)` stops collapsing to its label.
    const source = '## Read [`getData`](/api) now\n';
    expect(tocIds(source)).toEqual(renderedHeadingIds(source));
  });
});
