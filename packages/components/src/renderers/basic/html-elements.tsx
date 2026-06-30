/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Safe native HTML element passthrough renderers (ADR: kind:'html').
 *
 * A `kind:'html'` page is authored as a constrained JSX/Tailwind string that is
 * PARSED (never executed) into the SDUI tree. For that tier to live up to its
 * name, the everyday HTML tags an author reaches for — headings, paragraphs,
 * lists, links, images, emphasis — must each resolve to a renderer (otherwise
 * the parser flags them `unknown-component`). div / span / table / code / label
 * and the semantic sectioning tags are registered elsewhere; this module fills
 * in the rest of the safe flow/inline set.
 *
 * Safety: these render real DOM, but the html tier never executes JS, so props
 * are static literals from the parser. As defense-in-depth the passthrough
 * still strips event handlers (`on*`) and `dangerouslySetInnerHTML`, and
 * neutralizes `javascript:`/`data:` URLs on `<a href>`.
 */

import { ComponentRegistry } from '@object-ui/core';
import { renderChildren } from '../../lib/utils';
import { createElement, forwardRef } from 'react';

type AnyProps = { schema: any; className?: string; [key: string]: any };

// Tags that take no children.
const VOID_TAGS = new Set(['img', 'hr', 'br']);

// The safe set we own here. Deliberately excludes anything already registered
// (div, span, table, code, label, the semantic sectioning tags, html) and
// anything that can execute or escape (script, style, iframe, object, embed,
// link, meta, form, input, button — button is the shadcn component).
const TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'a', 'blockquote', 'pre',
  'strong', 'em', 'b', 'i', 'u', 'small', 'mark', 'sub', 'sup', 'del', 'ins', 'abbr',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'figure', 'figcaption', 'img', 'hr', 'br', 'time', 'address', 'cite', 'kbd', 'q',
] as const;

const PER_TAG_INPUTS: Record<string, Array<{ name: string; type: 'string' | 'number'; label: string }>> = {
  a: [
    { name: 'href', type: 'string', label: 'Link URL' },
    { name: 'target', type: 'string', label: 'Target' },
    { name: 'rel', type: 'string', label: 'Rel' },
    { name: 'title', type: 'string', label: 'Title' },
  ],
  img: [
    { name: 'src', type: 'string', label: 'Image URL' },
    { name: 'alt', type: 'string', label: 'Alt text' },
    { name: 'width', type: 'number', label: 'Width' },
    { name: 'height', type: 'number', label: 'Height' },
    { name: 'title', type: 'string', label: 'Title' },
  ],
  time: [{ name: 'dateTime', type: 'string', label: 'Datetime' }],
  abbr: [{ name: 'title', type: 'string', label: 'Title' }],
  q: [{ name: 'cite', type: 'string', label: 'Cite' }],
  blockquote: [{ name: 'cite', type: 'string', label: 'Cite' }],
};

function sanitizeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  // Disallow script-bearing schemes; allow http(s), mailto, tel, anchors, relative.
  if (/^(javascript|data|vbscript):/i.test(v)) return undefined;
  return v;
}

for (const tag of TAGS) {
  const isVoid = VOID_TAGS.has(tag);
  const Component = forwardRef<HTMLElement, AnyProps>(({ schema, className, ...props }, ref) => {
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      // never forward these onto raw DOM from authored source
      dangerouslySetInnerHTML: _dsih,
      children: _children,
      ...rest
    } = props;

    // Strip event handlers (the html tier has no JS; these would be inert/strings).
    const safe: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) {
      if (/^on[A-Z]/.test(k)) continue;
      safe[k] = val;
    }
    if (tag === 'a' && 'href' in safe) safe.href = sanitizeHref(safe.href);

    return createElement(
      tag,
      {
        ref,
        className,
        ...safe,
        'data-obj-id': dataObjId,
        'data-obj-type': dataObjType,
        style,
      },
      isVoid ? undefined : renderChildren(schema?.children ?? schema?.body),
    );
  });
  Component.displayName = `Html${tag.charAt(0).toUpperCase()}${tag.slice(1)}`;

  ComponentRegistry.register(tag, Component, {
    namespace: 'ui',
    label: tag.toUpperCase(),
    category: 'basic',
    inputs: [
      { name: 'className', type: 'string', label: 'CSS Class' },
      ...(PER_TAG_INPUTS[tag] ?? []),
    ],
  });
}
