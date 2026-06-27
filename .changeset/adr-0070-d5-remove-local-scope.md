---
'@object-ui/app-shell': patch
---

feat(studio): remove the "Local / Custom" stopgap scope from the package selector (ADR-0070 D5)

The package-scope selector no longer offers a synthetic "Local / Custom (this
env)" entry (the `package_id = null` / `sys_metadata` orphan bucket from
objectui#1946). That was a deliberate stopgap; ADR-0070 makes every
runtime-authored item live in a writable **base**, the kernel rejects orphan
creates (`writable_package_required`), and legacy orphans are adopted into a
base via "Adopt loose items". With no authoring path producing orphans, the
bucket has no reason to exist.

- `buildPackageScopeOptions` now returns only writable bases (drops the appended
  sentinel); `isLocalScope` / `LOCAL_PACKAGE_ID` / `writableBaseOptions` and the
  inline `LOCAL_SCOPE_ID` in `ContextSelectors` are removed.
- The create-flow and list/home scope filters simplify accordingly (a real base
  is always the active scope; never the null/local sentinel).
- Read-side `sys_metadata` provenance handling (classifying a row as
  runtime-authored, artifact detection in the editor) is unchanged — the kernel
  still keeps `null` as a legacy read tag.

Closes the D5 tail of #2278 (the migration tooling it depended on already
shipped).
