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

import { ComponentRegistry, type ActionResult } from '@object-ui/core';
import { ActionCtxReact } from '@object-ui/react';
import { renderChildren } from '../../lib/utils';
import { createElement, forwardRef, useContext } from 'react';
import type { MouseEventHandler } from 'react';

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

/**
 * Resolve an authored href to an app-root-absolute path (`/apps/...`) when it
 * is an internal SPA link, or null when the browser should handle it natively
 * (scheme-qualified, protocol-relative, or in-page fragment links).
 *
 * Authored pages write app-root-relative hrefs (`apps/<app>/<object>`,
 * `docs/<name>`). A raw `<a>` resolves those against `document.baseURI`,
 * which only lands on the app root when the host injected a matching `<base>`
 * tag — without one (root-mounted consoles, vite dev) the browser nests the
 * path under the current page URL and 404s (objectui#2638). Routing internal
 * links through the SPA's navigation handler makes them deployment-agnostic.
 */
function toInternalPath(href: unknown): string | null {
  if (typeof href !== 'string' || href.trim().length === 0) return null;
  const v = href.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // http:, https:, mailto:, tel:, …
  if (v.startsWith('//')) return null; // protocol-relative external
  if (v.startsWith('#')) return null; // in-page fragment
  try {
    // Resolve ./ and ../ segments against a synthetic root so the result is
    // app-root-absolute regardless of the current page path.
    const u = new URL(v, 'https://internal.invalid/');
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
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

    // Internal links navigate through the SPA router (via the url action's
    // navigation handler) instead of a raw browser navigation, so they no
    // longer depend on a host-injected <base> tag (objectui#2638). Modified
    // clicks, new-tab targets, fragments, and external URLs keep native
    // behavior; without an ActionProvider the anchor stays untouched.
    const actionCtx = useContext(ActionCtxReact);
    let onClick: MouseEventHandler | undefined;
    if (tag === 'a' && actionCtx) {
      const path = toInternalPath(safe.href);
      const linkTarget = typeof safe.target === 'string' ? safe.target : '';
      if (path && (!linkTarget || linkTarget === '_self')) {
        onClick = (e) => {
          if (e.defaultPrevented || e.button !== 0) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          // The url action keeps SPA-vs-full-page semantics (`/api/` paths
          // escape the router); with no navigation handler wired it reports
          // the redirect back for us to follow. Success toasts are suppressed
          // — following a link is not a feedback-worthy "action".
          void actionCtx.runner
            .execute({ type: 'url', target: path, toast: { showOnSuccess: false } })
            .then((r: ActionResult) => {
              if (r?.success && r.redirect) window.location.assign(r.redirect);
            });
        };
      }
    }

    return createElement(
      tag,
      {
        ref,
        className,
        ...safe,
        ...(onClick ? { onClick } : {}),
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
