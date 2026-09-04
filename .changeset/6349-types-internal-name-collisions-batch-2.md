---
'@object-ui/types': minor
---

The last two exported type names with two authorities *inside* `@object-ui/types` now have
one each (objectui#6349, second batch — the remaining intra-package collisions from the
census on objectui#6273). Both took the **rename** branch, because in both cases the two
declarations are genuinely different types; the surviving spelling is in each case the name
`src/index.ts` has always published that declaration under, so **no importable name
changes** and the barrel alias becomes a plain re-export.

**`MenuItem` — renamed to `AppMenuItem` in `app.ts`.** `app.ts` declared a flat,
all-optional `interface` (`type?: 'item' | 'group' | 'separator'`, `label`, `icon`, `path`,
`href`, `children`, `badge`, `hidden`) — the `@deprecated` legacy navigation item that
`AppComponentSchema.menu`, `AppAction.items` and `menuItemToNavigationItem` read.
`overlay.ts` declared a discriminated **union**, `MenuCommandItem | MenuDividerItem`, whose
command arm requires `label` and whose both arms **tombstone** `type` as `type?: never`
(objectui#6523) — precisely the key `app.ts` declares as a three-value enum. Re-pointing
either at the other would have made an authored `type: 'separator'` legal on one side and a
type error on the other, so the two names had to part. `@object-ui/types` continues to
publish overlay's union as `MenuItem` and app's interface as `AppMenuItem`, exactly as
before.

**`ValidationFunction` — renamed to `FieldValidationFunction` in `field-types.ts`.**
`data-protocol.ts` declares `(value, context?: ValidationContext) => boolean | string`;
`field-types.ts` declared `(value) => boolean | string | Promise<boolean | string>`. They
disagree at both ends of the arrow — different parameter lists, and a `Promise` return that
the data-protocol signature does not admit — so field-types' is not assignable to
data-protocol's in the direction that matters. `data-protocol.ts` had said so in prose ("may
differ from similarly named validation function types in other packages (e.g., in
`field-types`)") for as long as both existed. The published names `ValidationFunction`
(data-protocol's) and `FieldValidationFunction` (field-types') are unchanged.

Both `KNOWN_COLLISIONS` lines come down in the same change; that baseline fails in **both**
directions, so converging without deleting them is red too. 38 entries -> 36.
