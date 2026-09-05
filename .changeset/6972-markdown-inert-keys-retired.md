---
'@object-ui/types': minor
'@object-ui/plugin-markdown': minor
---

**Breaking for authored metadata:** `MarkdownSchema.sanitize` and
`MarkdownSchema.components` are RETIRED (objectui#6972, ADR-0049
enforce-or-remove). A `markdown` node that authors either key no longer
validates: the parse fails loudly on that key's path with the explanation in
the message, and both TS members are `?: never` tombstones, so the same document
is refused at compile time. The two keys do not share a disposition — triage
recorded the asymmetry — so each is argued below.

## `sanitize`

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

## `components`

**What was measured, on this branch's base.** `components` was declared
`?: Record<string, any>` ("custom components for markdown elements") on both
faces and read by NOTHING: the `components` map `MarkdownImpl` hands to
`ReactMarkdown` is its own module-level `mdComponents` (the mermaid / metadata
fence overrides), never merged with anything off the schema, and
`grep -rn "schema.components"` over `packages/` and `apps/` returns nothing
against the same `schema.content` control. The premise the PM declared
falsifiable — *no host path consumes a `components` map* — was re-measured
before this half was written: `MarkdownImplProps` has no such prop, `LazyMarkdown`
receives only `content` and `className`, and no plugin API, app-shell or runner
site passes one.

**Why remove and not wire, and why not a runtime slot.** A map of React
component overrides is not a value a JSON document can author — the same shape
as the handler keys objectui#6124 retired ("JSON has no function value"). The
`runtime-slot` disposition keeps a TypeScript twin callable when a host-supplied
value actually reaches a renderer; nothing reaches this one, so there is no twin
to keep and the TS face refuses it outright. This half is the PM's disposition
under a declared veto window on objectui#6972, not a maintainer ruling; the PR
stays draft for contract review. A real override slot must arrive as a proposal
WITH its enforcing reader, not by reviving this key.

```json
{ "type": "markdown",
  "content": "# Hello",
  "components": { "h1": "h2" } }   // ← was tolerated, changed nothing
```

now fails validation with:

> RETIRED (objectui#6972) — never read: the markdown renderer forwards only
> `content` and `className`, and a map of React component overrides is not a
> JSON-authorable value. Delete the key; the fenced mermaid / metadata block
> overrides are the renderer's own fixed map, not an authoring surface.

## Both keys

**Two published faces.** `@object-ui/plugin-markdown` re-exports `MarkdownSchema`
from `@object-ui/types` (one authority since objectui#6172) rather than
declaring a copy, so the retirement reaches its consumers through the same
declaration — which is why this changeset names the plugin as well: no plugin
source changes, but the type its published face exposes narrows, and its own
test now pins that the refusal arrives there.

**Who is NOT affected.** A document that never wrote either key is untouched
(`absent` stays valid), `content` and `className` are unchanged, and the
renderer's behaviour is byte-identical — it sanitized unconditionally before
and does now, and its fenced-block overrides are the same fixed map. One
in-repo fixture authored either key
(`packages/types/examples/data-display-examples.json#examples.markdown`,
`"sanitize": true`); the key is deleted from it and the fixture is now pinned
to parse green. No fixture, catalog entry, doc snippet, skill or app in this
repository authored `components` on a markdown node.

**Migration:** delete the keys. There is nothing to replace either with — the
behaviour `sanitize` claimed to control is always on, and no authored spelling
overrides markdown elements.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote the tolerated key. It is not `major` per
this repo's fixed-group convention (objectui's own breaking changes ship as
`minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
mechanically enforced by `scripts/check-changeset-no-major.mjs`).
