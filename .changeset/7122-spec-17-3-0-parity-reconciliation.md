---
'@object-ui/types': minor
'@object-ui/components': patch
'@object-ui/cli': patch
'@object-ui/plugin-detail': patch
---

Reconcile the declared surface with `@objectstack/spec` 17.3.0 (objectui#7122).

⚠️ **`@object-ui/types` is graded `minor` for a breaking surface change.**
The exported `ObjectSchemaClientExtensions` narrows from

```ts
export interface ObjectSchemaClientExtensions { editMode?: 'modal' | 'page' }
```

to

```ts
export type ObjectSchemaClientExtensions = Record<never, never>;
```

Two breaking consequences for a consumer that names the type directly. **(1)** It
no longer declares `editMode`; the key is now carried by the spec's
`ServiceObject`, so `ObjectSchemaMetadata` still has it, but code written against
the extension type ALONE loses it. **(2)** `interface` → type alias also ends
**declaration merging**: a consumer that reopened
`declare module '@object-ui/types' { interface ObjectSchemaClientExtensions { … } }`
to add its own client-side member no longer compiles, because an alias cannot be
reopened. `minor` rather than `major` per `AGENTS.md`'s version-alignment rule —
objectui's own breaking changes are graded `minor` with the semantics stated in
the body, since any `major` in the fixed group would push all 39 packages off
`@objectstack`'s major.

**`ObjectSchema.editMode` is now the spec's.** 17.3.0 adopted the key (measured:
the accept set went 42 → 43, gained set exactly `['editMode']`, lost set empty,
declared as the same `'page' | 'modal'` union objectui carried). Its local copy
is retired from `ObjectSchemaClientExtensions`, which is what that type's own pin
prescribed for this event, leaving the client delta empty. Nothing is removed
from the product: `editMode` stays authorable and stays typed on
`ObjectSchemaMetadata`, carried by the spec's `ServiceObject` instead of by a
local member — and a published, spec-validated object document may now carry it,
which at 17.2.0 was refused by name.

**`user:profile` is retired across all three sites.** 17.3.0 dropped it from
`PageComponentType` (measured: the enum went 34 → 32 options, lost set exactly
`['user:profile', 'element:form']`, gained set empty). objectui went on knowing
it in three places, so all three moved together: the Studio palette exclusion
ledger, `PROTOCOL_COMPONENTS` in `renderers/placeholders.tsx`, and the
regenerated `known-schema-types.ts` the CLI checks schemas against. Nothing
user-reachable went with it — neither type had a renderer, `user:profile` had
only the dashed "Component Placeholder" scaffold, and the app shell's own
profile affordance is a React slot, never this block type. A page schema still
naming it now draws the loud "Unknown component type" panel rather than a silent
grey box, which is this repo's standing treatment for a type outside the
supported surface.

**`record:details` sections document the eight keys 17.3.0 added.**
`group`, `hideEmpty`, `collapsible`, `showBorder`, `defaultCollapsed`, `icon`,
`description` and `headerColor` are now declared on a section entry (4 → 12
members). Six of the eight are already honoured by `DetailSection`, so the
`sections` input description now teaches all of them, and says plainly which two
are not read here. Designer controls for them are a separate feature and are
deliberately not added.
