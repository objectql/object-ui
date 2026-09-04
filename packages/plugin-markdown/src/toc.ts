/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import GithubSlugger from "github-slugger"

export interface TocItem {
  /** Heading level (1–6). */
  depth: number
  /** Visible heading text, inline markdown stripped. */
  text: string
  /** Slug id, identical to what `rehype-slug` puts on the rendered heading. */
  id: string
}

/**
 * A code span's slot while the other inline rules run: private-use sentinels
 * around its index in `codeSpans`.
 *
 * Inert to the emphasis and raw-HTML rules (it carries no `*`, `_` or angle
 * bracket), but still ORDINARY TEXT to the image and link rules — which is
 * what keeps ``[`getData`](/api)`` collapsing to its label, exactly as the
 * renderer does.
 */
const SLOT_OPEN = "\uE000"
const SLOT_CLOSE = "\uE001"
const SLOT_RE = /\uE000(\d+)\uE001/g
const SENTINEL_RE = /[\uE000\uE001]/g

/**
 * Strip the inline-markdown wrappers so the text matches `rehype-slug`'s.
 *
 * Code spans are lifted out BEFORE any other rule and put back verbatim at the
 * end, because markdown inside a code span is not markdown: `rehype-slug` slugs
 * the rendered heading's flattened text, and a code span contributes its content
 * as a literal text value inside `<code>`. Rules run over already-unwrapped
 * code-span text therefore delete characters the anchor is built from — the
 * raw-HTML rule ate `<type>` out of `` `objectui generate <type> <name>` `` and
 * the emphasis rules ate the underscores out of `` `a_b_c` `` — so the TOC's
 * `#id` named a heading anchor that does not exist (objectui#7658).
 *
 * The raw-HTML rule itself stays: `remark-rehype` runs without
 * `allowDangerousHtml`, so it drops raw html nodes and keeps the text they
 * wrapped, which is what removing the tags reproduces. Sentinels present in the
 * source are dropped first, so no input can forge a slot.
 */
function stripInline(s: string): string {
  const codeSpans: string[] = []
  return s
    .replace(SENTINEL_RE, "") // no input can forge a slot
    .replace(/`([^`]+)`/g, (_match, content: string) => {
      codeSpans.push(content)
      return `${SLOT_OPEN}${codeSpans.length - 1}${SLOT_CLOSE}`
    }) // inline code → an opaque slot
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/<[^>]+>/g, "") // raw html
    .replace(SLOT_RE, (_match, index: string) => codeSpans[Number(index)]) // code spans, verbatim
    .trim()
}

/**
 * Build a table of contents from Markdown source.
 *
 * Slugs are generated with the SAME `github-slugger` that `rehype-slug` uses,
 * walking every heading in document order so duplicate-heading `-1/-2` suffixes
 * line up — that is what makes a `#id` TOC link resolve to the rendered
 * heading's anchor. Headings inside fenced code blocks are ignored. Only
 * `minDepth..maxDepth` (default h2–h3) are returned, but all headings still
 * advance the slugger so ids stay in sync.
 */
export function extractToc(
  markdown: string,
  opts?: { minDepth?: number; maxDepth?: number },
): TocItem[] {
  const minDepth = opts?.minDepth ?? 2
  const maxDepth = opts?.maxDepth ?? 3
  const slugger = new GithubSlugger()
  const items: TocItem[] = []
  let fence: string | null = null

  for (const line of (markdown ?? "").split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) fence = marker
      else if (marker === fence) fence = null
      continue
    }
    if (fence !== null) continue

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const depth = m[1].length
    const text = stripInline(m[2])
    if (!text) continue
    const id = slugger.slug(text) // advance the slugger for EVERY heading
    if (depth >= minDepth && depth <= maxDepth) items.push({ depth, text, id })
  }
  return items
}
