---
'@object-ui/types': minor
'@object-ui/core': minor
---

Retire `CRUDSchema` and the `type: 'crud'` node spelling (objectui#5373,
maintainer ruling 2026-08-20, route 2) under ADR-0049 enforce-or-remove.

`crud` had four declaration faces and no registered renderer, for the whole
life of the key: the TS interface (`packages/types/src/crud.ts`), the zod
mirror (`packages/types/src/zod/crud.zod.ts`), a dedicated branch in
`validateSchema` that affirmatively PASSED it, and `CRUDBuilder` in
`@object-ui/core`. A node spelling it painted the OBJUI-001 "Unknown component
type" panel, and `content/docs/api/schema-reference.md` published it as
reference material — so a reader (or an AI author) who copied the page got a
red panel.

Removed from `@object-ui/types`: the `CRUDSchema` interface and its zod
mirror, the four shapes that existed only to type its keys — `CRUDOperation`,
`CRUDFilter`, `CRUDToolbar`, `CRUDPagination` and their zod mirrors and
`…SchemaType` aliases — and `CRUDSchema` as a member of `CRUDComponentSchema`,
which is what took it off the node union `AnySchema`. `ActionSchema`,
`DetailSchema` and `CRUDDialogSchema` are unchanged and remain the union's
members.

Removed from `@object-ui/core`: `CRUDBuilder` and the `crud()` factory.

Authoring `crud` is now REFUSED BY NAME rather than passed or silently
ignored. `validateSchema` returns an `error` with `code: 'RETIRED_TYPE'` on
`schema.type` — at any depth, since it is what `validateChildren` recurses
with — so `assertValidSchema` throws and `isValidSchema` answers `false`. The
message names the migration: `object-grid` for the record table with its
toolbar, filters, pagination and row/batch actions, `object-form` for the
create/edit form, and `detail` for the record view. `api/schema-reference.md`
is rewritten around those shapes.

Note on blast radius: the repository itself contains zero authored `crud`
nodes and zero registrations of the key (measured on the merge base against
the doc gate's own 659-key registry derivation, which reads `register` and
`registerLazy` alike). That is an IN-REPO zero, not an npm zero — a published
consumer that imported the `CRUDSchema` type, called `crud()` / `CRUDBuilder`,
or authored `type: 'crud'` will see a compile error or a validation error
respectively. Both are the intended, loud replacement for a shape that has
never rendered.
