---
'@object-ui/plugin-markdown': patch
---

Fix `extractToc` deleting tag-shaped text that lives INSIDE an inline code span,
so its `#id` links resolve to the heading they name again (objectui#7658).

`stripInline()` applied its rules in sequence: the inline-code rule unwrapped
`` `objectui add <component>` `` to `objectui add <component>`, and the raw-HTML
rule that ran next over that same text deleted `<component>` as if it were
markup. The slug became `objectui-add` while `rehype-slug` — which slugs the
RENDERED heading, where a code span's content is a literal text value — put
`objectui-add-component` on the anchor. The TOC entry rendered, was clickable,
and silently went nowhere. The same sequencing let the emphasis rules eat the
underscores out of `` `a_b_c` `` and the link rule rewrite `` `[x](y)` ``.

Code spans are now lifted out before any other inline rule runs and restored
verbatim at the end, so nothing reaches inside one. The raw-HTML rule is
unchanged and still strips genuine markup — `remark-rehype` runs without
`allowDangerousHtml`, so the renderer likewise drops raw html nodes and keeps the
text they wrapped. Link labels that are code spans still collapse (`` [`getData`](/api) ``
→ `getData`), because the placeholder stays ordinary text to the link rule.

Seven live headings in this repo's own docs were affected
(`content/docs/utilities/cli.mdx`, `content/docs/utilities/runner.mdx`,
`packages/cli/README.md`). Pinned against the real render pipeline rather than a
second derivation of the slug rules: the new test renders each heading through
`MarkdownImpl` and compares `extractToc`'s id to the `id` attribute
`rehype-slug` actually emitted.
