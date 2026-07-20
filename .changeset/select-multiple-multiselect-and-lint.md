---
"@object-ui/fields": minor
"@object-ui/core": patch
---

feat(fields): render `select` + `multiple` through the multi-value chip picker; restore fields/core lint gates

- **Multi-value select** — a `select` field/param declared `multiple: true`
  now renders the multi-value chip picker (the `multiselect` widget) and stores
  a `string[]`, instead of collapsing to a single-value dropdown that could
  hold only one value. The delegation lives inside `SelectField`, so the object
  form, the inline grid editor, and the app-shell `ActionParamDialog` all
  inherit it from the one `select` widget with no per-surface drift. Single
  selects keep the cascading dropdown (multi + per-option `visibleWhen`
  cascading is not a combination in use today).
- **`autonumber` mapping is unchanged** here; this change is orthogonal.
- **Lint gates restored** — fixed the pre-existing baseline lint errors that
  had left the `@object-ui/fields` and `@object-ui/core` package lints red (so
  the gate could not catch new violations): `react-hooks/rules-of-hooks` in
  `ImageField` / `TextAreaField` / `index.tsx` (hooks hoisted above early
  returns; the `useFieldTranslate` hook no longer wrapped in try/catch), plus
  `no-useless-assignment` / `no-useless-escape` / `no-control-regex` /
  `prefer-const` / `preserve-caught-error` in the core evaluator and utils. No
  behavior change from the lint fixes.
