---
'@object-ui/types': minor
---

Export `ComboboxOption` from the `@object-ui/types` root entry (objectui#7697).

**Additive only.** `ComboboxOption` is added to the root barrel's existing named
re-export list from `./form.js`, next to the sibling option types that were already
there (`SelectOption`, `RadioOption`). Nothing is removed, retyped or narrowed: the
declaration stays in `src/form.ts`, its three members (`value`, `label`, `disabled?`)
are unchanged, and the `@object-ui/types/form` subpath spelling keeps working exactly
as before. Both spellings now resolve to the same declaration.

**Why it was missing.** objectui#7691 made this package the single authority for the
name — `@object-ui/components` stopped declaring its own copy and now re-exports this
one — but reached it through the `/form` subpath, because the root barrel was held by
objectui#7683 at the time. That choice was deliberate and was judged sound on its own
merits (the subpath is a house pattern, alongside `@object-ui/types/zod` and
`@object-ui/types/internal/retired-field-keys`); this release is the follow-up
objectui#7691 could not take, not a correction of it.

**What changes for you.** `import type { ComboboxOption } from '@object-ui/types'` now
compiles; on the previous release it read `TS2305` while its two siblings on the same
list resolved. If you already import from `@object-ui/types/form`, or through
`@object-ui/components`, nothing changes and no migration is needed — both remain
supported and are pinned as such.
