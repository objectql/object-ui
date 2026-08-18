---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/plugin-grid": minor
---

Retire the structured `confirm` object on actions (objectui#4314, maintainer ruling
2026-08-17, ADR-0049 enforce-or-remove). `confirmText` is now the one confirm
spelling — the only one the translation bundle can address
(`{ns}.objects.{obj}._actions.{name}.confirmText`), matching `@objectstack/spec`'s
action surface.

Breaking semantics (flagged `minor` per this repo's version-alignment policy):

- `@object-ui/types`: `ActionSchema.confirm` is a `?: never` tombstone — authoring
  it is now a tsc error, and the Zod twin rejects any authored value at parse time
  (it previously accepted the object). The backwards `@deprecated` note that
  steered authors from `confirmText` INTO the structured arm is gone.
- `@object-ui/core`: `ActionRunner` no longer reads `confirm.message` (which used
  to outrank `confirmText`, untranslated). `ActionDef.confirm` carries the same
  `never` tombstone. The `ConfirmationHandler` signature is unchanged, but the
  runner now invokes it without the `options` argument.
- `@object-ui/plugin-grid`: `resolveBulkActions` no longer falls back to
  `confirm.message` when promoting an object action — spec metadata can never
  deliver that key.

Nothing in the repo, the example apps, or the schema catalog authored the
structured form (verified on the issue); a dialog authored that way silently lost
localization. Reopen condition recorded on objectui#4314: real demand returns the
arm WITH bundle keys designed in.
