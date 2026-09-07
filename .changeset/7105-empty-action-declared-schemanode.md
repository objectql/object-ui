---
'@object-ui/types': minor
'@object-ui/components': minor
---

Declare `EmptySchema.action` as `SchemaNode`, mirror it, and relax the renderer so
declared equals enforced (objectui#7105, maintainer ruling of 2026-09-07, decision
batch #69, option (a)).

`empty` has rendered an `action` node, and the docs page has documented it, for a
long time — while four surfaces disagreed about whether the capability existed.
`EmptySchema` declared `type` / `title` / `description` / `icon` and no `action`;
the zod mirror declared the same four; the renderer's `registrationMeta.inputs`
listed `title` / `description` / `className`, so the designer could not offer the
key either. Only the docs row said it was there. The renderer's read compiled
solely because `BaseSchema` ends in `[key: string]: any` and the read went through
a cast — which is also why objectui#6150's census, scanning for un-cast
`schema.KEY` reads, could not see this reader at all.

**Authoring change.** `action` is now a declared, mirrored, editor-completable key
on `empty`. Previously an author writing against the published type could not
author it: it was accepted only vacuously, through the index signature.

**Behaviour change.** The renderer required the value to be an object, which made
this slot NARROWER than the `SchemaNode` its sibling node slots (`body`,
`children`, `DataTableSchema.emptyAction`, the overlay `trigger` / `content`
slots) declare — a bare string `action` was silently DROPPED rather than
rendered. It now renders as text, which is what `SchemaRenderer` does with a
primitive node anywhere else. Nothing was coerced to achieve this: the value goes
through `toRenderableSchema`, the repo's existing total-function bridge from the
`SchemaNode` union onto the renderer's declared prop.

**Validation change, in the narrowing direction.** The mirror is `.passthrough()`,
so `action` already parsed green as an unexamined key. Its VALUE is now judged: an
`action` that is neither a node object carrying a `type` nor a primitive is
refused where it was previously admitted. Notably `{ label, onClick }` — which is
`ToastSchema.action`'s shape, a different interface — no longer passes here.

The docs row moves from `BaseSchema` to `SchemaNode` to match, and objectui#7082's
recorded row for this key (pinned as "documented but declared nowhere", with its
header promising the file would go red the day it was declared) is inverted in
place rather than deleted.
