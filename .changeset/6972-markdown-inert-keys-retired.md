---
'@object-ui/types': minor
'@object-ui/plugin-markdown': minor
---

**Breaking for authored metadata:** `MarkdownSchema.sanitize` is RETIRED
(objectui#6972, ADR-0049 enforce-or-remove). A `markdown` node that authors
`sanitize` — either value — no longer validates: the parse fails loudly on the
`sanitize` path with the explanation in the message, and the TS member is a
`?: never` tombstone, so the same document is refused at compile time.

**What was measured, on this branch's base.** `sanitize` was declared
`?: boolean` with `@default true` on both published faces — `data-display.ts`
and the Zod mirror — documented, and read by NOTHING. Worse than an ordinary
inert key, it implied a switch that does not exist: sanitization is
**unconditional**. `rehypePlugins` in `plugin-markdown/src/MarkdownImpl.tsx` is
a module-level `const` array whose last link is `[rehypeSanitize, sanitizeSchema]`,
handed to `ReactMarkdown` as-is — no ternary, no `if`, no runtime assembly.
`MarkdownRenderer` forwards exactly `content` and `className`, and
`MarkdownImplProps` accepts only those two. A repo-wide grep for
`schema.sanitize` over `packages/` and `apps/` returns nothing, against a
control of 20 `.tsx` files reading `schema.content` in the same query shape, so
the zero is a reading, not a blind query. An author writing `sanitize: false`
believed they turned XSS filtering off; one writing `sanitize: true` believed
they turned it on. Neither was true.

**Why remove and not enforce.** The enforce arm of enforce-or-remove for this
key is a switch that DISABLES XSS sanitization, which is not an acceptable
outcome; for `sanitize` the ruling collapses to remove (triage on
objectui#6972).

**Who is affected — a `sanitize` authored onto a `markdown` node:**

```json
{ "type": "markdown",
  "content": "# Hello",
  "sanitize": false }   // ← was tolerated, changed nothing
```

now fails validation with:

> RETIRED (objectui#6972) — sanitization is unconditional: rehype-sanitize is a
> fixed last link of the markdown renderer's rehype chain, and no value of this
> key ever switched it. There is no authored spelling that disables XSS
> sanitization; delete the key.

**Two published faces.** `@object-ui/plugin-markdown` re-exports `MarkdownSchema`
from `@object-ui/types` (one authority since objectui#6172) rather than
declaring a copy, so the retirement reaches its consumers through the same
declaration — which is why this changeset names the plugin as well: no plugin
source changes, but the type its published face exposes narrows, and its own
test now pins that the refusal arrives there.

**Who is NOT affected.** A document that never wrote the key is untouched
(`absent` stays valid), `content` and `className` are unchanged, and the
renderer's behaviour is byte-identical — it sanitized unconditionally before
and does now. One in-repo fixture authored the key
(`packages/types/examples/data-display-examples.json#examples.markdown`,
`"sanitize": true`); the key is deleted from it and the fixture is now pinned
to parse green.

**Migration:** delete the key. There is nothing to replace it with — the
behaviour it claimed to control is always on.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote the tolerated key. It is not `major` per
this repo's fixed-group convention (objectui's own breaking changes ship as
`minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
mechanically enforced by `scripts/check-changeset-no-major.mjs`).
