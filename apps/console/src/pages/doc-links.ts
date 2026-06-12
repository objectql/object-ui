/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Rewrite ADR-0046 package-doc cross-references for console rendering.
 *
 * Docs reference each other with plain relative Markdown links —
 * `[guide](./crm_lead_guide.md#anchor)` — because the authoring tree is
 * flat, resolution is a basename lookup: strip `./` and `.md` to get the
 * target doc name. The console renders a doc at `/docs/<name>`, so this
 * rewrites those links to `](/docs/crm_lead_guide#anchor)` before the
 * Markdown renderer sees them.
 *
 * Fenced code blocks and inline code spans are left untouched so a doc
 * can show the link syntax literally.
 */

const FENCE_RE = /(^```[^\n]*\n[\s\S]*?\n```[ \t]*$|^~~~[^\n]*\n[\s\S]*?\n~~~[ \t]*$)/m;
const INLINE_CODE_RE = /(`[^`\n]+`)/;
const DOC_LINK_RE = /\]\((?:\.\/)?([a-z][a-z0-9_]*)\.md(#[^)\s]*)?\)/g;

function rewriteProse(segment: string): string {
  return segment
    .split(INLINE_CODE_RE)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(DOC_LINK_RE, '](/docs/$1$2)')))
    .join('');
}

export function rewriteDocLinks(markdown: string): string {
  const out: string[] = [];
  let rest = markdown;
  // FENCE_RE has no /g so each exec finds the next fence in `rest`;
  // alternating prose/fence segments are rewritten/preserved respectively.
  for (;;) {
    const m = FENCE_RE.exec(rest);
    if (!m || m.index === undefined) {
      out.push(rewriteProse(rest));
      return out.join('');
    }
    out.push(rewriteProse(rest.slice(0, m.index)), m[0]);
    rest = rest.slice(m.index + m[0].length);
  }
}
