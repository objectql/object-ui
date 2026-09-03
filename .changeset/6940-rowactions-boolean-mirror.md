---
'@object-ui/types': patch
---

`DataTableSchema.rowActions` validates as the boolean it has always been declared to be
(objectui#6940, maintainer ruling 2026-09-02, director seat summon #8, option A).

The hand-written zod mirror in `zod/data-display.zod.ts` declared
`rowActions: z.array(z.any()).optional()`. Every other face of the same key says
**boolean**: the TS declaration it mirrors (`rowActions?: boolean`), the renderer's
destructuring default (`rowActions = false`), its two truthiness gates and two
`colSpan` arithmetic sites, the registered authoring input
(`{ type: 'boolean', label: 'Show Row Actions' }`), `defaultProps: { rowActions: true }`,
and the renderer's own docblock example, which authors `"rowActions": true`. The mirror
was the single outlier — and the published one, so `safeValidateSchema` refused the
exact spelling the component's documentation, defaults and authoring UI all teach. Two
shipped `examples/schema-catalog` entries (`user-table.json`, `full-featured-table.json`)
failed validation for this and no other reason; both now validate **unchanged**.

**Patch, not minor or major, and the reasoning is the ruling's own:** no author can have
relied on an array value. The renderer never reads the array — it only truthiness-tests
the key — so the smallest zod-valid array, `[]`, rendered the actions column identically
to `true` (objectui#6318 measured both at 42 elements with the `Actions` header present,
against 39 with the key absent). An array authored here could therefore never have
carried meaning to any consumer: it either behaved exactly like `true` or, if empty,
still behaved exactly like `true`. Narrowing it takes away a spelling that was accepted
but inert, not one anything could have depended on.

A `boolean | array` union was considered and **not** taken: it would permanently accept
a shape the renderer cannot act on, which is the same second de-facto contract that the
array spelling already was.

The list view's same-named `rowActions` in `zod/objectql.zod.ts` — `z.array(z.string())`,
the legacy bare-name action list on `ObjectGridSchema` — is a **different key** that is
correct as it stands, is in parity with its own TS twin (`rowActions?: string[]`), and is
not touched.
