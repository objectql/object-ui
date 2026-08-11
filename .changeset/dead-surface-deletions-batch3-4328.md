---
'@object-ui/types': minor
'@object-ui/core': minor
'@object-ui/react': minor
'@object-ui/data-objectstack': patch
---

Retire four zero-consumer declared surfaces (dead-surface sweep batch 3, #4328). Each was
measured as declared-but-never-read at the branch point, and each is removed rather than
left as an authoring surface whose values nothing acts on.

Breaking for anyone who typed against the removed declarations, marked `minor` per this
repository's version-alignment convention (the major tracks `@objectstack`, never an
API-break count):

- `@object-ui/core` no longer exports `mergeViewsIntoObjects`. It was a second copy left
  behind by the move of that step to the provider layer, and it had drifted: it ignored a
  view container's default `list` and keyed views by the authored bare key instead of the
  composer's `<object>.<key>` identity. The live implementation — `MetadataProvider`'s, in
  `@object-ui/app-shell` — is unchanged and remains the only one. (#3775)
- `@object-ui/types`' `RoleDefinition` no longer declares `permissions`. A role's grants
  live in `ObjectPermissionConfig.roles`, keyed by object; that is the only home any
  consumer reads (`resolveRoles` walks `inherits` and matches on `name`). The removed
  field was *required*, so five fixtures across three packages had been declaring an empty
  array for a value nothing would ever look at. Role-attached grants are now a compile
  error rather than silently ignored data. (#4288)
- `@object-ui/react`'s `RecordContextValue` no longer declares `loading` / `error`. Both
  had zero producers and zero consumers — no host passed them, no `record:*` renderer read
  them — and only the provider's memo dependency list still named them. Record-level
  loading and error state stays where it is actually expressed: each renderer's own data
  source. (#3773)

No behaviour change, no request-count change:

- `@object-ui/data-objectstack` drops five `metadataCache.invalidate('views:<object>')`
  calls across `updateViewConfig` / `createView` / `updateView` / `deleteView`. No read
  path has ever populated that key — `listViews` fetches directly, uncached — so all five
  were permanent no-ops. The invalidations of the keys that do have readers
  (`view:<object>:<viewId>` for `getView`, `view-overrides:<object>` for
  `listViewOverrides`) are untouched and now pinned. (#3778)
