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

/** Strip the inline-markdown wrappers so the text matches `rehype-slug`'s. */
function stripInline(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/<[^>]+>/g, "") // raw html
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
