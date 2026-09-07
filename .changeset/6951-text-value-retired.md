---
'@object-ui/types': minor
'@object-ui/components': minor
'@object-ui/plugin-dashboard': patch
---

**Breaking for authored metadata:** `TextSchema.value` is RETIRED (objectui#6951,
maintainer ruling A1 of 2026-09-04; objectui#7016; ADR-0049 enforce-or-remove).
A `text` node that authors `value` no longer validates: the parse fails loudly on
the `value` path with the explanation in the message, the TS member is a
`?: never` tombstone so the same document is refused at compile time, and the
renderer no longer reads the key. Write `content`.

**What was measured, on this branch's base.** `TextSchema` declared two spellings
for its one content slot — `content` (read first) and `value` (the fallback limb
of `{schema.content || schema.value}` at `renderers/basic/text.tsx:162` and
`:167`) — both declared by objectui#6150, whose docblock called the pair "a
dialect, not a design" and deferred the choice. The ruling's premise, that
`value` is the minority spelling, was measured before any edit over the four
roots it named: **776 `content`-only `text` nodes, 25 `value`-only, 0 authoring
both** across `examples/` (674 / 13), `apps/` (59 / 0), the `examples/`
directories under `packages/` (0 / 1) and `content/docs/**` (43 / 11) — a
thirty-to-one majority for `content`, so the retirement went ahead as ruled.
(A further 14 `{ value, label, type: "text" }` objects in the filter-builder
catalog entries are field descriptors whose `type` is a field type, not `text`
nodes, and were excluded by kind.)

**Who is affected — a `value` authored on a `text` node:**

```json
{ "type": "text",
  "value": "Hello" }   // ← was tolerated (rendered as the fallback)
```

now fails validation with:

> RETIRED (objectui#6951) — `value` is no longer part of TextSchema; write
> `content`. It was a second spelling of the one content slot, read only as the
> fallback limb of `schema.content || schema.value`, and was retired under
> ADR-0049 enforce-or-remove with no deprecation window (maintainer ruling A1,
> 2026-09-04). The renderer reads `content` alone now, so an authored `value`
> would render nothing. Rename the key; the string is unchanged.

**Two published faces, one retirement.** The TypeScript interface `TextSchema`
(`@object-ui/types`, `layout.ts`) declares `value?: never`; the Zod mirror
`TextSchema` (`@object-ui/types/zod`, `layout.zod.ts`) declares `value` as a
`retirementTombstone()`, so the key stays DECLARED and is refused BY NAME —
a plain deletion would have let an authored `value` ride `BaseSchema`'s
`.passthrough()` into a silent blank, which is worse than the tolerated
fallback it replaces. The `value?: string` members of `TextSpanSchema` and
`TabsSchema` in the same file are other schemas' contracts and are unchanged.

**`@object-ui/components`** — the `text` renderer renders `{schema.content}` at
both arms (the `|| schema.value` limb is gone from each), and the `context-menu`
renderer's built-in fallback trigger node now spells `content`. Nothing else in
the package moves. **`@object-ui/plugin-dashboard`** — its three placeholder
`text` nodes ("chart type is not supported yet", "Custom widget — set
`component`…", the retired-widget notice) spell `content` so they keep rendering;
their wording is unchanged and still pinned.

**Who is NOT affected.** A document that already wrote `content` is untouched;
`content`, `variant`, `align` and `className` are unchanged; `absent` stays
valid (`{ "type": "text" }` still parses). Every in-repo document that authored
`value` on a `text` node was rewritten to `content` in the same change: nine
`examples/schema-catalog` entries, `packages/types/examples/zod-validation-example.ts`,
eleven doc fences under `content/docs/`, and the `@object-ui/components`,
`@object-ui/react` and `@object-ui/types/zod` README samples; the catalog is now
pinned tree-wide against the retired spelling.

**Migration:** rename `value` to `content` on every `text` node; the string is
unchanged. If a document authored both, `content` was already the value that
rendered — delete `value`.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote the tolerated spelling. It is not `major` per
this repo's fixed-group convention (objectui's own breaking changes ship as
`minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
mechanically enforced by `scripts/check-changeset-no-major.mjs`).
