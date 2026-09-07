---
'@object-ui/plugin-calendar': minor
'@object-ui/plugin-kanban': minor
---

Declare the `filter` input on every `object-kanban` / `object-calendar`
registration (objectui#7712) — the html tier stops reporting `unknown-prop` on a
key the spec declares and both renderers read.

`ObjectKanban.tsx` sends the authored key to the query as `$filter: schema.filter`
and `ObjectCalendar.tsx` does the same, and `@objectstack/spec`'s
`ComponentPropsMap` declares `filter` on both blocks (measured: `safeParse`
accepts it, and refuses an undeclared key by name on the same call). But none of
the four registrations that publish those two renderers listed `filter` in
`inputs`, and `sdui-parser`'s `validateTree` reports `unknown-prop` for every key
no `inputs` entry claims. So an author writing the one spelling that WORKS was
told it was unknown — objectui#6678's shape, where a correct write draws the same
diagnostic as a write that does nothing. That is worse than an inert key: it
actively punishes the correct behaviour, and the honest response to it is to
delete working metadata.

ADR-0049 enforce-or-remove resolves toward **declare**, not remove: the key has
live readers on both ends, so the registrations were the side that was wrong. The
declaration is `type: 'array'` on all four, matching the `filter` that
`object-grid`'s `GRID_QUERY_INPUTS` and `object-metric` already publish, and it is
writable as one shape only because objectui#7711 landed first and retired the
object-shaped `filter.calendar` spelling — `filter` is the query filter and
nothing else.

Declared per key against the spec rather than derived from the
`ElementDataSourceMapping` sitting beside these registrations, even though that
mapping already asserts `filter` is a live query key. Measured, that derivation
would be wrong: the kanban mapping also carries `limit`, and the spec's strict
`ComponentPropsMap['object-kanban']` **rejects** `limit` by name, so emitting it
would publish a key the save gate refuses.

⚠️ Note for whoever meets this class next: `check:react-blocks-declaration-parity`
runs manifest → spec, one direction. A key the SPEC declares and the manifest
omits is structurally outside what that ratchet measures, so fixing these four
registrations does **not** make the next omission loud. Making that ratchet
bidirectional is its own card.
