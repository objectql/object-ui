---
---

Docs only, publishes nothing: batch 2 of 2 for objectui#6138 — the remaining
**22** `content/docs/fields` pages have their `Field Schema` block converted from
a self-declared interface to a literal **annotated** against that field type's
exported `*FieldMetadata`, each linking the shared
`content/docs/fields/widget-props.mdx` page batch 1 added.

A self-declared interface with no imports type-checks no matter what it says, so
`check-doc-snippet-types` reported these pages green while being structurally
unable to see whether the documented shape matched the shipped one. An annotated
literal is judged by the compiler instead: the page becomes incapable of teaching
a key the type does not have.

That property depends on the annotated types being **sealed**, so it was measured
rather than assumed. All 26 types this batch annotates against — the 22 field
metadata types plus `SelectOptionMetadata`, `GridColumnDefinition`,
`UploadedFileMetadata` and `LookupColumnDef` — carry no index signature, and a
nonsense key on each produces `TS2353`. The same control run against the
components lane's `BaseSchema` / `ButtonSchema` produces **zero** diagnostics,
which is what an open type does and why that lane cannot use this mechanism
(objectui#6143).

Documentation defects the conversion forced out, each a page teaching something
no shipped type declares:

- `grid.mdx` documented a per-column `editable` flag and a string `width`.
  `GridColumnDefinition` declares neither — `width` is a number of pixels — and
  no widget reads a column-level `editable`. Both are corrected.
- `formula.mdx` documented `return_type` as taking `currency`; the shipped union
  is `'text' | 'number' | 'boolean' | 'date' | 'datetime'`.
- `lookup.mdx` documented option keys `_id` and `name`; the widget matches
  options by `value` and labels them by `label`, and those two keys are read off
  **records**, not options.
- `user.mdx` documented the value as a user object; the field stores the user's
  id and the picker resolves the rest from `sys_user`.

Two undeclared-but-consumed keys were found by checking each divergence against
its renderer, and are filed rather than deleted or documented as metadata:
`dependsOn` on select and `description` on a lookup's static options
(objectui#6153, the same class as objectui#6140). The location field's stored
`{ latitude, longitude }` value shape is declared by no exported type at all
(objectui#6154), so that page describes it in prose and points at the card.

The gate's blocks-to-compile count rises from 248 to 249 — 21 conversions are
one-block-for-one-block and `lookup.mdx` becomes two blocks (data-source-backed
and static-option) — with diagnostics at 0, no new `FRAGMENT_MARKER`
declarations, and the declared-fragment count unmoved at 111.
