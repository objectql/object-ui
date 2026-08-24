---
'@object-ui/types': minor
'@object-ui/mobile': minor
---

Retire the `MobileOverrides` type and its `mobileOverrides` mount point (objectui#4919,
maintainer ruling 2026-08-19, ADR-0049 enforce-or-remove).

`MobileOverrides` published a six-key mobile override surface — `layout`, `columns`,
`useBottomSheet`, `fullScreen`, `touchTarget` and a three-value `navigation` vocabulary
(`'bottom-tabs' | 'hamburger' | 'drawer'`) — from `@object-ui/types` and, re-exported,
from `@object-ui/mobile`. Nothing read any of it. Measured on current `main`: the type had
exactly four mentions repo-wide — its own declaration, the single
`MobileComponentConfig.mobileOverrides` mount point, and the two barrel re-exports — and
the lower-case property name (the spelling a renderer would actually read) appeared only
in that declaration. No renderer, hook or adapter resolved it, and a sweep of the example
apps and the `objectstack` sibling checkout found zero authors. The three `navigation`
values were three spellings of the same no-op.

The declared surface is removed rather than narrowed. The #3985 lineage's rule is "narrow
to the implemented values"; here the implemented set is empty, so that rule terminates in
deletion — a config that type-checks, builds and silently does nothing is the
declare-without-enforce shape the platform doctrine forbids.

Removal rather than a `?: never` tombstone follows this package's own discriminator. A
tombstone exists to steer authors to a named live replacement — `crud.ts` `confirm` →
`confirmText` (objectui#4314), `data-display.ts` `hoverable` / `striped` → `data-table`
(objectui#5474) — or to keep a key loud that the docs had actively taught as working.
Neither applies: there is no replacement key to steer to, no documentation ever described
the surface, and there is no successor spelling. That is the same zero-pull, no-successor
shape as the retired `AccordionItem.icon` (objectui#4652) and `ToggleGroupItem.icon`
(objectui#4632), both of which were removed outright rather than tombstoned.

**Breaking for TypeScript authors of `MobileOverrides` / `mobileOverrides` only** (marked
`minor` per this repo's version-alignment rule, which reserves `major` for following
`@objectstack` across a major — see AGENTS.md's 版本号策略, and the identical
classification used for `AccordionItem.icon`). Runtime behaviour is unchanged: an authored
`mobileOverrides` did nothing before and does nothing now. What changes is that the
contract no longer claims otherwise, so the mistake surfaces at authoring time — importing
the type is now a "has no exported member" error, and authoring the key on a
`MobileComponentConfig` object literal is an excess-property error, instead of a silent
no-op that type-checks and builds.

If real mobile-override renderer work is ever wanted it re-enters deliberately, as designed
product surface on its own card, with the renderer landing in the same change as the
declaration — not by resurrecting this declaration.
