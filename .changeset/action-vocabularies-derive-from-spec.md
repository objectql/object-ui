---
'@object-ui/types': major
---

**The action sub-vocabularies derive from `@objectstack/spec` instead of restating it (framework#4074).**

`packages/types/src/ui-action.ts` imported exactly one of the spec's action
vocabularies — `ActionType`, derived in #2231/#2901 — and hand-declared the rest
under doc comments claiming spec canonicity. `ActionLocation`'s comment said
"Single source of truth lives in `@objectstack/spec/ui` … **re-export** here"
while the code re-*declared* a parallel union, `as const` tuple, and `z.enum`.

That is why framework#3856 predicted a compile error when spec 17 removed
`action.execute` and there wasn't one: nothing in this package was bound to the
spec's `z.infer`, so a key removal upstream produced no signal here.

**Already drifted, not merely drift-prone.** `ActionParamSchema.type` is
`FieldType.optional()` and `FieldType` carries **49** members; the hand-written
`ActionParamFieldType` listed **16**. A spec-valid param typed `lookup`,
`multiselect`, `currency`, `user`, `tags` or `json` failed `tsc` against this
package even though `ActionParamDialog` renders it — the same failure `ActionType`
had before it was derived (missing `form` while `ActionRunner.executeForm`
implemented it).

- `ActionLocation` / `ACTION_LOCATIONS` / `ActionLocationSchema` are now the spec's
  own three symbols, re-exported. `ACTION_LOCATIONS` and `ActionLocationSchema`
  stay **value** exports, as #2561 decision (a) explicitly keeps them.
- `ActionComponent` is `NonNullable<Action['component']>`. Read off the spec's
  resolved `Action` rather than `ActionSchema.shape.component`, because spec
  exports `ActionSchema` as a `lazySchema` proxy that does not forward `.shape`.
- `ActionParamFieldType` is the spec's `FieldType` (16 → 49 members), with
  `ACTION_PARAM_FIELD_TYPES` as its runtime witness.
- `ActionParam` gains the 13 optional capability fields it could not express —
  `visible`, `accept`, `maxSize`, `multiple`, and the lookup-picker group
  (`referenceTo`, `displayField`, `idField`, `descriptionField`, `titleFormat`,
  `lookupColumns`, `lookupFilters`, `lookupPageSize`, `dependsOn`) — all of which
  `@object-ui/core`'s `ActionParamDef` already declares and app-shell's
  `paramToField.ts` maps into the shared field renderer (ADR-0059).

**The legacy param spellings are now named, not hidden.** `paramToField.ts` folds
`checkbox` → `boolean`, `reference` → `lookup`, `datetime-local` → `datetime`.
None is a spec `FieldType`, so deriving `ActionParamFieldType` alone would have
made authored metadata a type error. They are declared as
`ObjectUiLocalParamFieldType` / `OBJECTUI_LOCAL_PARAM_FIELD_TYPES` and
`ActionParam.type` accepts `ResolvableParamFieldType` (spec ∪ local) — the same
shape `ObjectUiLocalActionType` / `RunnableActionType` already use for
`navigation`, and for the same reason: a dialect hidden inside a
`Record<string, string>` in another package is invisible to an importer.

**Breaking:** `ActionParamFieldType` widens from 16 members to 49, so an
exhaustive `switch` over a param `type` in a host app stops being exhaustive. The
16 old members are all still valid, so no authored metadata breaks. The added
`ActionParam` fields are optional and additive.

Not included, and still open on framework#4074: `ActionParam`'s `name` / `label` /
`type` stay required where the spec makes them optional, and the
`field` / `objectOverride` field-reference form remains unrepresentable. Both are
breaking in a way that needs its own migration note.
