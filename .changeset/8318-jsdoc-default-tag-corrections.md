---
'@object-ui/types': patch
---

Nine published `@default` JSDoc tags now describe a measured read site
(objectui#8318, maintainer ruling 2026-09-09: a documentation-vs-implementation
mismatch is a documentation fix — no key is retired and no renderer's behaviour
moves).

`packages/types`' build carries JSDoc into `dist/*.d.ts`, and `dist` is in this
package's `files`, so these are edits to PUBLISHED TEXT: an author reading
`DetailSchema.loading` in an editor tooltip was being told the opposite of what
the renderer does. No accept set, no exported symbol and no payload key changes.

**Two tags were wrong** — `DetailSchema.loading` and `DetailViewSchema.loading`
published `@default true`, while `plugin-detail/src/DetailView.tsx:995` reads the
key as a bare disjunct, `if (loading || schema.loading)`, beside the component's
own fetch state. An omitted key is `undefined` and contributes nothing, so the
value applied on absence is `false`. The `true` arrived in `6f132f29`
(2026-07-13), a bulk JSDoc pass copying the zod mirror's old `.default(true)`;
it was never an authored intent. Giving the reader the `?? true` the tag
promised would draw a skeleton on every detail view that omits the key — a
behaviour change, and a product question of its own that this ruling did not
open.

**Seven tags had no reader to describe**, and they are not one fact — each
docblock now carries its own evidence instead of a shared sentence:

- `CRUDDialogSchema.size` / `.closeOnOutsideClick` / `.closeOnEscape` /
  `.showClose` — there is no `register('crud-dialog'` anywhere, so no node of
  that type ever reaches a renderer. Recorded once on the interface. Per key,
  the name census differs: two spellings occur nowhere outside the declaration
  and its zod twin, and `showClose`'s one other occurrence
  (`renderers/overlay/drawer.tsx:38`) belongs to `DrawerSchema`.
- `ActionSchema.level` — `type: 'action'` is not a rendered node type, and
  `core/src/actions/ActionRunner.ts`, which is what makes `method` / `chainMode`
  / `reload` / `close` live, does not read `level`.
- `CardSchema.variant` — `card` IS registered, twice, and neither registration
  reads it: the `ui` route forwards the key to `ui/card.tsx`, which spreads onto
  a `div` and mentions `variant` nowhere, and the `page` route forwards only its
  designer props.
- `PageNodeSchema.isDefault` — `page` IS registered, and `PageRenderer` neither
  reads the key nor forwards it: the wrapper element gets `toDomProps(props)`,
  an allow-list that does not carry it.

Until objectui#7735 the zod mirror's `.default()` substituted these values into
parsed documents, which is what the tags were describing; with that gone they
described nothing that runs.

The pin `packages/types/src/__tests__/layout-default-jsdoc-7361.test.ts` grows
from 15 rows to 24, both sides derived off disk as before.
