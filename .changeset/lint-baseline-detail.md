---
"@object-ui/plugin-detail": patch
---

chore(lint): clear the baseline lint errors in plugin-detail (objectui#2713 Wave 3)

Wave 3 of the #2713 lint-gate restoration. `@object-ui/plugin-detail` was red at
baseline on `main`; cleared every **error** (no behavior change; warnings out of
scope). All nine are `react-hooks` errors — the record renderers called hooks
after conditional early returns, which is a real fragility (React throws when the
guard toggles between renders), so each is restructured so hooks run
unconditionally while the rendered output stays identical:

- **`record-reference-rail`** — hoisted `useState` above the empty-entries early
  return (no dependency on it).
- **`record-related-list`** — moved the `!objectName` placeholder return below
  the four hooks (`usePermissions` / `useFieldPermissions` / `useRelatedRecordActions`
  / `useMemo`); those hooks are pure context/memo reads, safe with an empty
  object name. The object-level read gate ordering is unchanged (covered by
  `RecordRelatedListRenderer.readgate.test`).
- **`record-quick-actions`** — moved the `requiredPermissions` gate below
  `useActionEngine` (a pure `useContext`/`useMemo` hook).
- **`record-highlights`** — `useId` + `useRegisterHighlightFields` now run
  unconditionally; the permission gate is enforced after them. Because
  `useRegisterHighlightFields` has a register effect, it is passed `[]` when the
  gate denies — equivalent to not registering, so no body field is ever hidden
  for highlights that aren't rendered.
- **`RelatedList`** `SectionIcon` (`react-hooks/static-components`) —
  `resolveIconComponent` is a stable registry lookup, not a component created
  during render → justified scoped disable.
