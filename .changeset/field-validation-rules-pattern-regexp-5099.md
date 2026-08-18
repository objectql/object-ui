---
'@object-ui/types': minor
'@object-ui/components': minor
---

`FieldValidationRules.pattern.value` narrows to `RegExp`, and the form renderer reports unrecognized validation rule names loudly (objectui#5099, maintainer ruling 2026-08-18).

**BREAKING for hand-written form schemas — deliberately declared `minor`.** This
repo's version policy reserves `major` for tracking `@objectstack` majors and is
mechanically enforced (`scripts/check-changeset-no-major.mjs`); per that policy,
objectui's own breaking changes ship as `minor` with the breaking semantics
stated plainly here:

- **What breaks:** `validation: { pattern: { value: '^…$', message } }` with a
  **string** value no longer compiles. Write a `RegExp` literal instead:
  `pattern: { value: /^…$/, message }`.
- **Why red is the fix, not the damage:** react-hook-form applies `pattern`
  only when `value instanceof RegExp`, and the renderer's single read point
  spreads `validation` verbatim — so every string pattern accepted by the old
  type ran **zero** validations, silently. Callers turning red were not
  validating anything yesterday; the error converts silent non-validation into
  explicit failure at authoring time.
- **Unaffected:** the metadata route. `FieldSchema.pattern` (a string in field
  metadata) is still compiled by `buildValidationRules` in `@object-ui/fields`
  via `new RegExp(...)` before it reaches the renderer.

Also, per the same ruling's second limb, the form renderer now reports rule
names react-hook-form does not run (`console.error`, message doubles as the fix
instruction): a misspelled `minlength`, an invented `email`, or numeric keys
left by spreading an array into `validation` shout instead of vanishing. The
recognized set is pinned against the installed react-hook-form bundle so a
future bump cannot silently rot the diagnostic. The ruling's rejected half is
equally binding and equally pinned by test: the read point does **not** compile
string patterns — that consumer-side tolerance would harden the ambiguous
declaration into contract (AGENTS.md #0.1).
