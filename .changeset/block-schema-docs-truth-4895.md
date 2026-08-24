---
---

Docs and a gate ledger only — this publishes nothing, declared explicitly with an empty
frontmatter rather than left undeclared. No package `src/` is touched: the two files
changed are `content/docs/blocks/block-schema.mdx` and
`scripts/check-doc-component-types.mjs`.

Corrects `content/docs/blocks/block-schema.mdx` to the vocabulary the repository actually
declares, per the maintainer ruling recorded on objectui#4895 (Option B: docs-truth fix,
the block family re-scoped as type-level).

The page taught a `{ type: 'slot', name: 'content' }` node inside
`BlockSchema.template`. `template` is typed `SchemaNode | SchemaNode[]`, so that snippet
sat on the render path — and `slot` is registered nowhere. Measured against the
`check-doc-component-types.mjs` derivation of the registered universe (659 keys), the only
keys matching `/block|slot/` are `blockquote` and `ui:blockquote`. A reader who copied the
snippet got the renderer's `OBJUI-001` "Unknown component type" panel. That node is
deleted, and the page now teaches `slotContent`, the key `BlockSchema` and
`BlockInstanceSchema` actually declare.

**`slotContent` is documented as declared-but-not-yet-consumed, not as the working path**,
because that is what it measures as. Outside `packages/types` — the interface, its Zod
mirror, and that package's own parse test — nothing in the repository reads `slotContent`,
`slots` or `template`. Rewriting one phantom into a second phantom is the failure this card
exists to close, so the page states the status plainly instead of implying a runtime that
does not exist. For the same reason the component-schema framing is dropped from
`block-library` / `block-editor` / `block-instance`: none of them appears in `AnySchema`,
the runtime node union in `packages/types/src/index.ts`.

Two further measurements are written into the page because they are what a confused reader
needs. The four `<SchemaExample>` demos it embeds are ordinary registered component trees
(`card`, `flex`, `stack`, `text`, `icon`, `button`, `badge`) — none carries `type: 'block'`,
`slots` or `slotContent`, so nothing on the page was ever exercising the block vocabulary.
And the slot system that *is* wired end to end is a different family entirely: slotted
record pages (`kind: "slotted"`, `page.slots`), consumed by `usePageAssignment`,
`PageBlockCanvas` and `PageBlockInspector`. The page now links there rather than leaving the
two `slots` spellings to be conflated.

The `slot` entry in `DOC_TYPE_EXEMPTIONS` pointed at this card and is dropped, as the ruling
requires. With the phantom node gone the entry would itself fail as `stale-exemption`, so it
is deleted rather than re-pointed; the three terse family reasons are re-pointed at the
ruling's framing in the same pass.

Option A (build renderers for the family) is rejected on zero pull and Option C (retire the
family) is deferred; neither is implemented here.
