---
'@object-ui/components': patch
---

The form renderer no longer leaks `FormSchema.previousValues` onto the `<form>` DOM node
(objectui#6396).

`previousValues` is a declared schema key with a real consumer: the renderer's
`previousRecord` memo, which binds `previous` for field-rule CEL predicates and is the
INSERT/UPDATE signal the read-only submit strip gates on (objectui#3484). That consumer
reads it off `schema` and is unchanged. The defect was on the other channel —
`SchemaRenderer` spreads every non-metadata top-level schema key as a React prop *in
addition* to handing the node over as `schema`, so an edit-mode host (`ObjectForm`, which
is what the `object-master-detail-form` header composes) delivered a second, top-level copy
in `...props`. The renderer already consume-and-drops that whole family before its DOM
spread — `objectName`, `onDirtyChange`, `defaultValues`, `fields`, `layout`, … —
and `previousValues` was the one member missing from the list.

Two things followed, on every edit-mode header render. React declined the prop and printed
`React does not recognize the previousValues prop on a DOM element`, and — measured on
React 19, and not recorded on the card — the persisted record was still stamped onto the
element as `previousvalues="[object Object]"`. Consume-and-dropping the duplicate removes
both.

Scope is the runtime leak only. The declared key stays exactly as declared
(`packages/types/src/form.ts`, `packages/types/src/zod/form.zod.ts` are untouched): it has
a live consumer, so there is nothing here for the enforce-or-remove channel.
