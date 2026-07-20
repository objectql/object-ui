---
"@object-ui/app-shell": patch
---

chore(lint): clear the baseline lint errors in app-shell (objectui#2713 Wave 3)

Final package of the #2713 lint-gate restoration — with this the whole workspace
is at **0 lint errors**. `@object-ui/app-shell` was red at baseline on `main`;
cleared every **error** (no behavior change; warnings out of scope):

- **`react-hooks/rules-of-hooks` (12)** — hooks called after conditional early
  returns, restructured so hook order is stable:
  - `SchemaForm`: hoisted the `issuesByPath` `useMemo` above the RawJsonEditor
    fallback guard, and `RecordField`'s five `useState` above its widget /
    specialized-editor early returns.
  - `MetadataPanel`: moved `if (!open) return null` below its three hooks.
  - `LayeredDiff`: moved the `if (code == null)` guard below the two `useMemo`s
    and made `rows` null-safe (`code == null ? [] : computeDiffRows(...)`).
  - `ViewPreview`: hoisted the `object-view` `schema` `useMemo` above the three
    render branches (the earlier branches shadow it locally).
- **`react-hooks/static-components` (12)** — icon/inspector/preview lookups
  (`getIcon`, `typeIcon`, `kindIcon`, `getMetadataPreview` / `…Inspector` /
  `…DefaultInspector`) are stable registry references → justified scoped disables.
- **`no-useless-assignment` (3)** — dead `= null` / `= []` initializers in
  `marketplaceApi` and the two ratchet tests (the only fall-through paths
  reassign first).
- **`@typescript-eslint/ban-ts-comment` (2)** — the `lucide-react/dynamic.mjs`
  imports in `getIcon` / `widgets` no longer error under the build's `tsc`, so
  the stale `@ts-ignore` directives are removed outright.
- **stale `eslint-disable` (1)** — removed a `@next/next/no-img-element`
  directive in `AgentPreview` whose plugin isn't loaded in the flat config.
