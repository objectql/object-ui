---
'@object-ui/types': minor
'@object-ui/permissions': minor
'@object-ui/console': patch
---

Retire two post-retirement dead surfaces (#4364, #4368). Both were measured at this
branch point rather than taken from their cards, and one card's premise only half held.

Breaking for anyone who typed against the removed declaration, marked `minor` per this
repository's version-alignment convention (the major tracks `@objectstack`, never an
API-break count):

- `@object-ui/types` and `@object-ui/permissions` no longer export
  `ObjectLevelPermission`. It declared a second, parallel home for object-scoped grants
  (`{ object, actions, effect?, conditions? }`) that nothing constructed, accepted or
  read once `RoleDefinition.permissions` was retired (#4288) — its only remaining
  referents were its own definition and the two barrel lines. The wired home is
  `ObjectPermissionConfig.roles`, whose inner grant shape is declared inline; that is
  what the evaluator reads, and it is unchanged. `ObjectPermissionConfig`'s doc comment
  now records the retirement so the surface is not re-declared. (#4364)

`PermissionCondition` was proposed for retirement on the same card and is **kept**: its
premise ("only referent is `ObjectLevelPermission.conditions`") did not hold at this
branch point. `evaluateCondition` in `@object-ui/permissions` takes it as a parameter
type and implements all eleven of its operators under a 26-case suite. `PermissionEffect`
is likewise untouched — `FieldLevelPermission.effect` still reads it.

No behaviour change, no public surface change:

- `@object-ui/console` drops `src/utils/metadataConverters.ts` and
  `src/services/MetadataService.ts`. Both were console-local duplicates of live
  `@object-ui/app-shell` modules and lost their last importer when the bespoke
  object-detail widgets were retired (#4365). Both had already drifted behind the live
  copies they duplicate — the console converter's `referenceTo` chain never read the
  server's `reference` key, and the console service predates the view cache-invalidation
  seam (#4373) — which is precisely the imitation trap the card recorded: an author
  grepping for "the converter" could land on the unexercised copy. The app-shell copies
  and their tests are untouched. (#4368)
